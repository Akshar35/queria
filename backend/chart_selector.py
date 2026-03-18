def select_charts(sql: str, data: list) -> list:
    if not data:
        return [{"type": "bar", "title": "Results"}]

    sql_upper = sql.upper()
    keys = list(data[0].keys())
    row_count = len(data)

    # Exclude year-like and id-like columns from numeric keys
    numeric_keys = [
        k for k in keys
        if isinstance(data[0][k], (int, float))
        and "year" not in k.lower()
        and "id" not in k.lower()
    ]
    string_keys = [k for k in keys if isinstance(data[0][k], str)]
    year_keys = [k for k in keys if "year" in k.lower()]

    has_year = len(year_keys) > 0
    has_group = "GROUP BY" in sql_upper
    has_aggregation = any(fn in sql_upper for fn in ["AVG(", "SUM(", "COUNT(", "MAX(", "MIN(", "ROUND("])

    charts = []

    # SINGLE ROW — stat card
    if row_count == 1:
        return [{"type": "stat", "title": "Result"}]

    # RAW DATA DUMP — too many rows, no aggregation
    if row_count > 50 and not has_aggregation:
        return [{"type": "bar", "title": "Results",
                 "xKey": string_keys[0] if string_keys else keys[0],
                 "yKeys": numeric_keys[:1] if numeric_keys else []}]

    # TIME SERIES — year column + aggregation + multiple rows
    if has_year and has_group and numeric_keys and row_count > 1:
        year_key = year_keys[0]
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
        return charts

    # SMALL DISTRIBUTION — 2 to 8 rows, one metric
    if 2 <= row_count <= 8 and len(numeric_keys) == 1 and string_keys:
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
        return charts

    # CORRELATION — mileage vs price scatter
    if "mileage" in keys and "price" in keys and not has_group:
        charts.append({
            "type": "scatter",
            "title": "Mileage vs Price Correlation",
            "xKey": "mileage",
            "yKey": "price"
        })
        return charts

    # MULTI METRIC — two numeric columns
    if len(numeric_keys) >= 2 and string_keys:
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
        return charts

    # DEFAULT — single bar chart
    charts.append({
        "type": "bar",
        "title": "Results",
        "xKey": string_keys[0] if string_keys else keys[0],
        "yKeys": numeric_keys[:1] if numeric_keys else [keys[-1]]
    })
    return charts