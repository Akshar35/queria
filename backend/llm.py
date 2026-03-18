import os
import re
import json
from google import genai
from pydantic import BaseModel
from dotenv import load_dotenv
from database import get_active_schema
from rag import RAGPipeline
from groq import Groq

load_dotenv()

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
rag = RAGPipeline()


SYSTEM_PROMPT = """You are an expert SQL analyst. Your ONLY job is to convert natural language questions into valid SQLite SQL queries.

{schema}

{rag_examples}

STRICT RULES:
1. Return ONLY the raw SQL query — no markdown, no backticks, no explanation
2. If the question cannot be answered with the available columns, return exactly:
   CANNOT_ANSWER: <one sentence reason>
3. Always use the EXACT table name and column names from the schema above
4. Always use aggregation functions for summary questions
5. Never invent columns that don't exist in the schema
6. Use ROUND() for decimal values
7. Limit raw row queries to 500 rows maximum
8. When user asks "mileage of [model]" — return AVG(mpg) grouped by model, NOT raw mileage rows
9. Never return raw rows when an aggregation makes more sense
"""

def generate_sql(user_query: str, chat_history: list = None) -> dict:

    # Step 1: RAG retrieval
    similar = rag.get_similar_examples(user_query, top_k=3)
    rag_context = rag.format_for_prompt(similar)

    # Step 2: Build prompt using the ACTIVE schema (BMW or uploaded CSV)
    system = SYSTEM_PROMPT.format(
        schema=get_active_schema(),
        rag_examples=rag_context
    )

    # Step 3: Include conversation history for follow-up context
    if chat_history and len(chat_history) > 0:
        history_context = "PREVIOUS CONVERSATION CONTEXT:\n"
        for msg in chat_history[-6:]:
            if msg['role'] == 'user':
                history_context += f"User Question: {msg['content'].get('question', '')}\n"
            else:
                history_context += f"Assistant SQL: {msg['content'].get('sql', 'No SQL generated.')}\n"
                history_context += f"Assistant Result (sample): {str(msg['content'].get('data', [])[:2])}\n"
        
        # This must be OUTSIDE the for loop
        history_context += f"\nNEW QUESTION: {user_query}\n"
        history_context += f"CRITICAL: If the new question uses words like 'its', 'this', 'that model', 'same' — they refer to the LAST query result above. Use the exact model/filter from the previous SQL.\n"
        full_user_prompt = history_context
    else:
        full_user_prompt = user_query

    # Step 4: Call Gemini
    print(f"🤖 Calling Gemini with: {user_query[:60]}...")
    response = client.models.generate_content(
        model="models/gemini-2.5-flash",
        config={
            "system_instruction": system,
            "temperature": 0.1,
            "max_output_tokens": 500
        },
        contents=full_user_prompt
    )

    result = response.text.strip()

    print(f"📝 Gemini  returned: {result[:100]}...")

    if result.startswith("CANNOT_ANSWER:"):
        return {
            "sql": None,
            "error": result.replace("CANNOT_ANSWER:", "").strip(),
            "cannot_answer": True,
            "rag_examples": similar
        }

    sql = re.sub(r'```sql|```', '', result).strip()

    return {
        "sql": sql,
        "error": None,
        "cannot_answer": False,
        "rag_examples": similar
    }



    

def generate_summary(user_query: str, sql: str, data: list) -> str:
    if not data:
        return "• No data found for this query."

    sample = data[:10]
    total_rows = len(data)

    prompt = f"""You are a senior business analyst presenting findings to a CEO. Be sharp, specific, and insightful.

User asked: "{user_query}"
Full dataset has {total_rows} rows. Top results:
{sample}

Write EXACTLY 3 bullet points that would impress a business executive.
Each bullet must:
- Name specific models/categories by name, not just numbers
- Show a surprising contrast, dominance, or trend
- Be under 20 words

Bad example: "• 470.8 is the highest avg_mpg among all models"
Good example: "• The i3 dominates efficiency at 470 mpg — nearly 8x more efficient than the M5"

Bad example: "• 58.1 is 4.6 less than 62.1 of 5 Series"
Good example: "• 5 Series edges out the 3 Series on efficiency despite being a larger, heavier vehicle"

Just 3 bullets starting with •. No intro, no explanation."""

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=300
        )
        text = response.choices[0].message.content.strip()
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        bullets = [l if l.startswith("•") else f"• {l.strip('•-– ')}" for l in lines]
        return "\n".join(bullets[:3])
    except Exception as e:
        print(f"❌ Summary error: {e}")
        return "• Unable to generate insights."







def generate_dataset_metadata(schema_info: str) -> dict:
    """Generate a 1-sentence description and 5-6 suggested queries for a new dataset."""
    prompt = f"""You are a data analyst. I have a new dataset with the following schema:
{schema_info}

Based on this schema, please provide:
1. A concise 1-sentence welcome message for a dashboard (e.g., "Analyze employee salaries and department distributions...").
2. 6 diverse, interesting natural language suggested queries that a user might want to ask this data.

Return your response in EXACTLY this JSON format:
{{
  "description": "your 1-sentence description here",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4", "suggestion 5", "suggestion 6"]
}}
"""
    class DatasetMetadata(BaseModel):
        description: str
        suggestions: list[str]

    response = client.models.generate_content(
        model="models/gemini-2.5-flash",
        config={
            "temperature": 0.4,
            "response_mime_type": "application/json",
            "response_schema": DatasetMetadata,
        },
        contents=prompt
    )
    
    try:
        data = json.loads(response.text)
        return {
            "description": data.get("description", "Explore this dataset and get instant, interactive charts."),
            "suggestions": data.get("suggestions", [])
        }
    except:
        return {
            "description": "Explore this dataset and get instant, interactive charts.",
            "suggestions": []
        }