import sqlite3
import pandas as pd
import os
import uuid
import json
from datetime import datetime

DB_PATH = "data/bmw.db"
CSV_PATH = "data/bmw.csv"

def _get_conn():
    return sqlite3.connect(DB_PATH)

def init_db():
    """Load default BMW CSV into SQLite on startup."""
    df = pd.read_csv(CSV_PATH)
    df.columns = df.columns.str.strip()
    df['model'] = df['model'].str.strip()
    df['fuelType'] = df['fuelType'].str.strip()
    df['transmission'] = df['transmission'].str.strip()

    conn = _get_conn()
    df.to_sql("vehicles", conn, if_exists="replace", index=False)

    conn.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            role TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )
    ''')
    # Dataset config table: stores active table name + schema description
    conn.execute('''
        CREATE TABLE IF NOT EXISTS dataset_config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    # Seed default BMW config
    existing = conn.execute("SELECT value FROM dataset_config WHERE key='table_name'").fetchone()
    if not existing:
        conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('table_name', 'vehicles')")
        conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('dataset_name', 'bmw.csv')")
        conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('schema_info', ?)", (get_schema_info(),))
        conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('description', ?)", ("Type a plain English question about BMW vehicle inventory and get instant, interactive charts — no SQL required.",))
        conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('suggestions', ?)", (json.dumps([
            "Average price by BMW model",
            "Price trend from 2010 to 2020",
            "Diesel vs petrol prices over years",
            "Most fuel efficient models",
            "Price by transmission type",
            "Top 5 most expensive models"
        ]),))

    conn.commit()
    conn.close()
    print(f"✅ DB initialized with {len(df)} rows")


def load_csv_into_db(file_path: str, original_filename: str) -> dict:
    """
    Load an uploaded CSV into a new SQLite table.
    Auto-detects schema, saves config. Returns schema info.
    """
    df = pd.read_csv(file_path)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Use a fixed table name (overwrite each upload for simplicity)
    table_name = "uploaded_data"

    conn = _get_conn()
    df.to_sql(table_name, conn, if_exists="replace", index=False)

    # Build dynamic schema description
    schema = _build_schema_description(df, table_name)

    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('table_name', ?)", (table_name,))
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('dataset_name', ?)", (original_filename,))
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('schema_info', ?)", (schema,))
    conn.commit()
    conn.close()

    print(f"✅ Loaded {original_filename} → {len(df)} rows, {len(df.columns)} columns")
    return {"table": table_name, "rows": len(df), "columns": list(df.columns), "schema": schema}


def save_dataset_metadata(description: str, suggestions: list):
    """Save generated metadata for the active dataset."""
    conn = _get_conn()
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('description', ?)", (description,))
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('suggestions', ?)", (json.dumps(suggestions),))
    conn.commit()
    conn.close()


def _build_schema_description(df: pd.DataFrame, table_name: str) -> str:
    """Dynamically generate schema description from a DataFrame."""
    lines = [f"TABLE: {table_name}", "COLUMNS:"]
    for col in df.columns:
        dtype = df[col].dtype
        if pd.api.types.is_integer_dtype(dtype):
            col_type = "INTEGER"
            sample = f"Range: {df[col].min()} – {df[col].max()}"
        elif pd.api.types.is_float_dtype(dtype):
            col_type = "REAL"
            sample = f"Range: {round(df[col].min(), 2)} – {round(df[col].max(), 2)}"
        else:
            col_type = "TEXT"
            unique_vals = df[col].dropna().unique()[:8]
            sample = f"Values include: {', '.join(str(v) for v in unique_vals)}"
        lines.append(f"- {col} ({col_type}): {sample}")

    lines.append(f"\nTOTAL ROWS: ~{len(df):,}")
    return "\n".join(lines)


def get_active_schema() -> str:
    """Return the currently active schema description."""
    conn = _get_conn()
    row = conn.execute("SELECT value FROM dataset_config WHERE key='schema_info'").fetchone()
    conn.close()
    if row:
        return row[0]
    return get_schema_info()  # fallback to BMW default


def get_active_table() -> str:
    conn = _get_conn()
    row = conn.execute("SELECT value FROM dataset_config WHERE key='table_name'").fetchone()
    conn.close()
    return row[0] if row else "vehicles"


def get_dataset_name() -> str:
    conn = _get_conn()
    row = conn.execute("SELECT value FROM dataset_config WHERE key='dataset_name'").fetchone()
    conn.close()
    return row[0] if row else "bmw.csv"


def get_dataset_metadata() -> dict:
    conn = _get_conn()
    desc_row = conn.execute("SELECT value FROM dataset_config WHERE key='description'").fetchone()
    sugg_row = conn.execute("SELECT value FROM dataset_config WHERE key='suggestions'").fetchone()
    conn.close()

    description = desc_row[0] if desc_row else "Explore this dataset and get instant, interactive charts."
    suggestions = json.loads(sugg_row[0]) if sugg_row else []

    return {"description": description, "suggestions": suggestions}


def reset_to_default():
    """Reset back to the BMW default dataset."""
    conn = _get_conn()
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('table_name', 'vehicles')")
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('dataset_name', 'bmw.csv')")
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('schema_info', ?)", (get_schema_info(),))
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('description', ?)", ("Type a plain English question about BMW vehicle inventory and get instant, interactive charts — no SQL required.",))
    conn.execute("INSERT OR REPLACE INTO dataset_config (key, value) VALUES ('suggestions', ?)", (json.dumps([
        "Average price by BMW model",
        "Price trend from 2010 to 2020",
        "Diesel vs petrol prices over years",
        "Most fuel efficient models",
        "Price by transmission type",
        "Top 5 most expensive models"
    ]),))
    conn.commit()
    conn.close()


# ── Session helpers ─────────────────────────────────────────────────────────

def create_session(title: str = "New Session"):
    session_id = str(uuid.uuid4())
    conn = _get_conn()
    conn.execute("INSERT INTO sessions (id, title) VALUES (?, ?)", (session_id, title))
    conn.commit()
    conn.close()
    return session_id

def get_sessions():
    conn = _get_conn()
    cursor = conn.execute("SELECT id, title, created_at FROM sessions ORDER BY created_at DESC")
    sessions = [{"id": r[0], "title": r[1], "created_at": r[2]} for r in cursor.fetchall()]
    conn.close()
    return sessions

def get_session_messages(session_id: str):
    conn = _get_conn()
    cursor = conn.execute(
        "SELECT id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,)
    )
    messages = [{"id": r[0], "role": r[1], "content": json.loads(r[2]), "created_at": r[3]} for r in cursor.fetchall()]
    conn.close()
    return messages

def add_message(session_id: str, role: str, content: dict):
    message_id = str(uuid.uuid4())
    conn = _get_conn()
    conn.execute(
        "INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)",
        (message_id, session_id, role, json.dumps(content))
    )
    conn.commit()
    conn.close()
    return message_id


def delete_session(session_id: str):
    """Delete a session and all its messages."""
    conn = _get_conn()
    conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()



# ── Query helpers ────────────────────────────────────────────────────────────

def run_query(sql: str):
    """Execute SQL and return results as list of dicts."""
    conn = _get_conn()
    try:
        cursor = conn.execute(sql)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return {"data": [dict(zip(columns, row)) for row in rows], "error": None}
    except Exception as e:
        return {"data": None, "error": str(e)}
    finally:
        conn.close()


def get_schema_info():
    """Hardcoded BMW schema — used as default."""
    return """
TABLE: vehicles
COLUMNS:
- model (TEXT): BMW model name
- year (INTEGER): 1996 to 2020
- price (INTEGER): listing price in GBP
- transmission (TEXT): Automatic, Manual, Semi-Auto
- mileage (INTEGER): total miles driven
- fuelType (TEXT): Petrol, Diesel, Hybrid, Electric, Other
- tax (INTEGER): annual road tax in GBP
- mpg (REAL): miles per gallon
- engineSize (REAL): engine displacement in litres

VALID VALUES:
- model: ['1 Series','2 Series','3 Series','4 Series','5 Series','6 Series',
          '7 Series','8 Series','M2','M3','M4','M5','M6',
          'X1','X2','X3','X4','X5','X6','X7','Z3','Z4','i3','i8']
- fuelType: ['Petrol','Diesel','Hybrid','Electric','Other']
- transmission: ['Automatic','Manual','Semi-Auto']
- year: 1996 to 2020
TOTAL ROWS: ~10,783
"""