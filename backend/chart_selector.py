def select_charts(sql: str, data: list) -> list:
    if not data:
        return [{"type": "bar", "title": "Results"}]

    sql_upper = sql.upper()
    keys = list(data[0].keys())

    # Exclude year-like columns from numeric keys
    numeric_keys = [k for k in keys if isinstance(data[0][k], (int, float)) and "year" not in k.lower()]
    string_keys = [k for k in keys if isinstance(data[0][k], str)]
    row_count = len(data)

    has_year_column = any("year" in k.lower() for k in keys)
    has_two_metrics = len(numeric_keys) >= 2

    charts = []

    # TIME SERIES — only if more than 1 row
    if has_year_column and numeric_keys and row_count > 1:
        year_key = next(k for k in keys if "year" in k.lower())
        charts.append({
            "type": "line",
            "title": "Trend Over Time",
            "xKey": year_key,
            "yKeys": numeric_keys
        })
        if len(numeric_keys) > 1:
            charts.append({
                "type": "bar",
                "title": "Metric Comparison by Year",
                "xKey": year_key,
                "yKeys": numeric_keys
            })

    # SMALL DISTRIBUTION — pie + bar
    elif row_count >= 2 and row_count <= 8 and len(numeric_keys) == 1 and string_keys:
        charts.append({
            "type": "pie",
            "title": "Distribution",
            "xKey": string_keys[0],
            "yKeys": numeric_keys
        })
        charts.append({
            "type": "bar",
            "title": "Comparison",
            "xKey": string_keys[0],
            "yKeys": numeric_keys
        })

    # CORRELATION
    elif "mileage" in keys and "price" in keys:
        charts.append({
            "type": "scatter",
            "title": "Mileage vs Price",
            "xKey": "mileage",
            "yKey": "price"
        })

    # MULTI METRIC
    elif has_two_metrics and string_keys:
        charts.append({
            "type": "bar",
            "title": "Primary Metric",
            "xKey": string_keys[0],
            "yKeys": [numeric_keys[0]]
        })
        charts.append({
            "type": "bar",
            "title": "Secondary Metric",
            "xKey": string_keys[0],
            "yKeys": [numeric_keys[1]]
        })

    # DEFAULT
    else:
        charts.append({
            "type": "bar",
            "title": "Results",
            "xKey": string_keys[0] if string_keys else keys[0],
            "yKeys": numeric_keys[:2] if numeric_keys else keys[1:]
        })

    return charts