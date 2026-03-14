import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import os
os.environ['TOKENIZERS_PARALLELISM'] = 'false'

# ── BMW-specific examples ─────────────────────────────────────────────────────
BMW_EXAMPLES = [
    {"q": "Show average price by model",
     "sql": "SELECT model, ROUND(AVG(price),0) as avg_price FROM vehicles GROUP BY model ORDER BY avg_price DESC"},
    {"q": "Price trend over the years",
     "sql": "SELECT year, ROUND(AVG(price),0) as avg_price FROM vehicles GROUP BY year ORDER BY year"},
    {"q": "Count of vehicles by fuel type",
     "sql": "SELECT fuelType, COUNT(*) as count FROM vehicles GROUP BY fuelType ORDER BY count DESC"},
    {"q": "Average mileage by transmission type",
     "sql": "SELECT transmission, ROUND(AVG(mileage),0) as avg_mileage FROM vehicles GROUP BY transmission"},
    {"q": "Most fuel efficient models by mpg",
     "sql": "SELECT model, ROUND(AVG(mpg),1) as avg_mpg FROM vehicles GROUP BY model ORDER BY avg_mpg DESC"},
    {"q": "Price comparison diesel vs petrol over years",
     "sql": "SELECT year, fuelType, ROUND(AVG(price),0) as avg_price FROM vehicles WHERE fuelType IN ('Diesel','Petrol') GROUP BY year, fuelType ORDER BY year"},
    {"q": "Top 5 most expensive models",
     "sql": "SELECT model, ROUND(AVG(price),0) as avg_price FROM vehicles GROUP BY model ORDER BY avg_price DESC LIMIT 5"},
    {"q": "How does mileage affect price",
     "sql": "SELECT mileage, price FROM vehicles ORDER BY mileage LIMIT 500"},
    {"q": "Average price by engine size",
     "sql": "SELECT engineSize, ROUND(AVG(price),0) as avg_price FROM vehicles GROUP BY engineSize ORDER BY engineSize"},
    {"q": "Distribution of transmission types",
     "sql": "SELECT transmission, COUNT(*) as count FROM vehicles GROUP BY transmission"},
]

# ── Generic structural SQL patterns (work for any dataset) ────────────────────
GENERIC_EXAMPLES = [
    {"q": "Count records grouped by a text category",
     "sql": "SELECT category_col, COUNT(*) as count FROM table_name GROUP BY category_col ORDER BY count DESC"},
    {"q": "Average of numeric column by category",
     "sql": "SELECT category_col, ROUND(AVG(numeric_col), 2) as avg_value FROM table_name GROUP BY category_col ORDER BY avg_value DESC"},
    {"q": "Top 10 rows by highest numeric value",
     "sql": "SELECT * FROM table_name ORDER BY numeric_col DESC LIMIT 10"},
    {"q": "Trend of numeric value over time (year column)",
     "sql": "SELECT year, ROUND(AVG(numeric_col), 2) as avg_value FROM table_name GROUP BY year ORDER BY year"},
    {"q": "Compare two category values of a column",
     "sql": "SELECT category_col, ROUND(AVG(numeric_col), 2) as avg_val FROM table_name GROUP BY category_col"},
    {"q": "Minimum and maximum range of a numeric column",
     "sql": "SELECT MIN(numeric_col) as min_val, MAX(numeric_col) as max_val FROM table_name"},
    {"q": "Count distinct unique values in a column",
     "sql": "SELECT COUNT(DISTINCT category_col) as unique_count FROM table_name"},
    {"q": "Sum of a numeric column by category",
     "sql": "SELECT category_col, SUM(numeric_col) as total FROM table_name GROUP BY category_col ORDER BY total DESC"},
    {"q": "Scatter relationship between two numeric columns",
     "sql": "SELECT col_x, col_y FROM table_name ORDER BY col_x LIMIT 500"},
    {"q": "Distribution of values across buckets",
     "sql": "SELECT category_col, COUNT(*) as count FROM table_name WHERE category_col IS NOT NULL GROUP BY category_col"},
]

ALL_EXAMPLES = BMW_EXAMPLES + GENERIC_EXAMPLES


class RAGPipeline:
    def __init__(self):
        print("🔄 Loading embedding model...")
        self.model = SentenceTransformer('all-MiniLM-L6-v2', device='cpu')
        self.examples = ALL_EXAMPLES
        self._build_index()
        print(f"✅ RAG pipeline ready ({len(self.examples)} examples)")

    def _build_index(self):
        questions = [e['q'] for e in self.examples]
        embeddings = self.model.encode(questions, convert_to_numpy=True)
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(embeddings.astype(np.float32))
        self.embeddings = embeddings

    def get_similar_examples(self, user_query: str, top_k: int = 3) -> list:
        """Retrieve top_k most similar example queries."""
        query_embedding = self.model.encode([user_query], convert_to_numpy=True)
        distances, indices = self.index.search(query_embedding.astype(np.float32), top_k)
        results = []
        for i, idx in enumerate(indices[0]):
            results.append({
                "question": self.examples[idx]['q'],
                "sql": self.examples[idx]['sql'],
                "similarity_score": float(distances[0][i])
            })
        return results

    def format_for_prompt(self, examples: list) -> str:
        """Format retrieved examples for injection into LLM prompt."""
        text = "SIMILAR EXAMPLE QUERIES (use as structural reference — adapt column names to the actual schema):\n"
        for i, ex in enumerate(examples, 1):
            text += f"\nExample {i}:\n"
            text += f"  Question: {ex['question']}\n"
            text += f"  SQL Pattern: {ex['sql']}\n"
        return text