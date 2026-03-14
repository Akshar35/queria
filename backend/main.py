from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import shutil, os, tempfile

from database import (
    init_db, run_query, create_session, get_sessions, get_session_messages,
    add_message, load_csv_into_db, get_active_table, get_dataset_name,
    reset_to_default, get_active_schema, save_dataset_metadata, get_dataset_metadata,
    delete_session
)
from chart_selector import select_charts
from llm import generate_sql, generate_summary, generate_dataset_metadata

app = FastAPI(title="BMW Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

@app.post("/query")
def handle_query(req: QueryRequest):
    # ── Greeting / off-topic detector ──────────────────────────
    greetings = ["hi", "hello", "hey", "how are you", "what can you do",
                 "help", "what is this", "who are you", "tell me about yourself",
                 "what do you do", "capabilities", "features", "sup", "yo"]
    
    question_lower = req.question.lower().strip().rstrip("?!.")
    
    if any(question_lower == g or question_lower.startswith(g) for g in greetings):
        return {
            "success": True,
            "is_greeting": True,
            "sql": None,
            "data": None,
            "charts": None,
            "row_count": 0,
            "summary": None,
            "message": None,
            "rag_examples_used": [],
            "response": """👋 Hello! I'm **Queria** — your conversational BI assistant.

Here's what I can do:

- **Ask any data question** in plain English — no SQL needed
- **Instant charts** — bar, line, pie, scatter generated automatically
- **AI insights** — key takeaways from every query
- **Follow-up questions** — filter or refine previous results
- **Upload your own CSV** — works with any dataset!"""
        }

    session_id = req.session_id
    if not session_id:
        title = req.question[:40] + "…" if len(req.question) > 40 else req.question
        session_id = create_session(title=title)
        chat_history = []
    else:
        chat_history = get_session_messages(session_id)

    add_message(session_id, "user", {"question": req.question})

    # Generate SQL using active schema
    llm_result = generate_sql(req.question, chat_history=chat_history)

    if llm_result["cannot_answer"]:
        add_message(session_id, "assistant", {"error": llm_result["error"], "cannot_answer": True})
        return {
            "success": False, "session_id": session_id, "cannot_answer": True,
            "message": llm_result["error"], "sql": None, "data": None, "charts": None
        }

    # Execute SQL
    db_result = run_query(llm_result["sql"])

    if db_result["error"]:
        # Self-healing: retry with error context
        retry_question = f"""This SQL failed: {llm_result['sql']}
Error: {db_result['error']}
Original question: {req.question}
Please fix the SQL using the exact table and column names from the schema."""
        llm_result = generate_sql(retry_question, chat_history=chat_history)
        db_result = run_query(llm_result["sql"])

    if db_result["error"] or not db_result["data"]:
        add_message(session_id, "assistant", {"error": "Could not retrieve data.", "sql": llm_result.get("sql")})
        return {
            "success": False, "session_id": session_id, "cannot_answer": False,
            "message": "Could not retrieve data for this query.", "sql": llm_result["sql"],
            "data": None, "charts": None
        }

    charts = select_charts(llm_result["sql"], db_result["data"])
    summary = generate_summary(req.question, llm_result["sql"], db_result["data"])

    response_content = {
        "sql": llm_result["sql"], "data": db_result["data"],
        "charts": charts, "summary": summary
    }
    add_message(session_id, "assistant", response_content)

    return {
        "success": True, "session_id": session_id,
        "sql": llm_result["sql"], "data": db_result["data"],
        "charts": charts, "summary": summary,
        "rag_examples_used": llm_result["rag_examples"],
        "row_count": len(db_result["data"])
    }


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV file to use as the active dataset."""
    if not file.filename.endswith(".csv"):
        return {"success": False, "error": "Only CSV files are supported."}

    # Save to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        result = load_csv_into_db(tmp_path, file.filename)
        
        # Generate and save dynamic metadata
        metadata = generate_dataset_metadata(result["schema"])
        save_dataset_metadata(metadata["description"], metadata["suggestions"])
        
        return {
            "success": True,
            "filename": file.filename,
            "rows": result["rows"],
            "columns": result["columns"],
            "table": result["table"],
            "description": metadata["description"],
            "suggestions": metadata["suggestions"]
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        os.unlink(tmp_path)


@app.post("/reset-dataset")
def reset_dataset():
    """Reset to the default BMW dataset."""
    reset_to_default()
    return {"success": True, "dataset": "bmw.csv"}


@app.get("/dataset-info")
def dataset_info():
    """Return info about the currently active dataset."""
    metadata = get_dataset_metadata()
    return {
        "name": get_dataset_name(),
        "table": get_active_table(),
        "is_default": get_active_table() == "vehicles",
        "description": metadata["description"],
        "suggestions": metadata["suggestions"]
    }


@app.get("/sessions")
def get_recent_sessions():
    return get_sessions()

@app.get("/sessions/{session_id}/messages")
def get_messages(session_id: str):
    return get_session_messages(session_id)

@app.delete("/sessions/{session_id}")
def delete_chat_session(session_id: str):
    delete_session(session_id)
    return {"success": True}


@app.get("/stats")
def get_stats():
    """Dynamic stats based on the active dataset."""
    table = get_active_table()

    # Check what numeric columns exist
    sample = run_query(f"SELECT * FROM {table} LIMIT 1")
    if not sample["data"]:
        return {}

    cols = list(sample["data"][0].keys())
    total = run_query(f"SELECT COUNT(*) as count FROM {table}")["data"][0]["count"]

    # Try to find useful stats dynamically
    stats = {"total": total, "dataset": get_dataset_name()}

    # Count distinct text columns (up to 2)
    text_cols = [c for c in cols if isinstance(sample["data"][0].get(c), str)]
    for col in text_cols[:1]:
        count = run_query(f"SELECT COUNT(DISTINCT {col}) as c FROM {table}")["data"][0]["c"]
        stats["categories"] = count
        stats["category_col"] = col

    # Find numeric ranges (up to 2 numeric columns)
    num_cols = [c for c in cols if isinstance(sample["data"][0].get(c), (int, float))]
    int_cols = [c for c in num_cols if isinstance(sample["data"][0].get(c), int) and 1900 < (sample["data"][0].get(c) or 0) < 2100]
    non_year_nums = [c for c in num_cols if c not in int_cols]

    if int_cols:
        yr = run_query(f"SELECT MIN({int_cols[0]}) as mn, MAX({int_cols[0]}) as mx FROM {table}")["data"][0]
        stats["year_range"] = {"min_yr": yr["mn"], "max_yr": yr["mx"]}
        stats["year_col"] = int_cols[0]

    if non_year_nums:
        pr = run_query(f"SELECT MIN({non_year_nums[0]}) as mn, MAX({non_year_nums[0]}) as mx FROM {table}")["data"][0]
        stats["value_range"] = {"min_p": pr["mn"], "max_p": pr["mx"]}
        stats["value_col"] = non_year_nums[0]

    return stats