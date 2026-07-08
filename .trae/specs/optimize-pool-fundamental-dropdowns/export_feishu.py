#!/usr/bin/env python3
"""Export Feishu Base daily report records to shared/fundamental-feed.json"""
import json, subprocess, sys, os, re

BASE_TOKEN = "Cxvob3GdTaEX2OspVWccfnWfnje"
TABLE_ID = "tblBxw2GPKuZx020"
OUT_PATH = "/workspace/shared/fundamental-feed.json"

VARIETIES = ["螺纹钢","碳酸锂","多晶硅","白糖","玻璃","橡胶","铜","黄金","白银","棕榈油"]

def text_val(v):
    """Extract text from a Feishu text cell value."""
    if v is None: return ""
    if isinstance(v, str): return v
    if isinstance(v, list):
        parts = []
        for x in v:
            if isinstance(x, dict):
                parts.append(x.get("text", x.get("name", "")))
            else:
                parts.append(str(x))
        return "".join(parts)
    if isinstance(v, dict):
        return v.get("text", v.get("name", ""))
    return str(v)

def num_val(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    if isinstance(v, str):
        try: return float(v)
        except: return None
    if isinstance(v, list) and v:
        if isinstance(v[0], dict):
            n = v[0].get("text", v[0].get("name"))
            try: return float(n)
            except: return None
    return None

def select_val(v):
    """Extract single-select option name."""
    if v is None: return None
    if isinstance(v, str): return v
    if isinstance(v, list):
        if not v: return None
        x = v[0]
        if isinstance(x, dict): return x.get("name")
        return str(x)
    if isinstance(v, dict): return v.get("name")
    return None

def date_val(v):
    """Datetime is ms timestamp."""
    if v is None: return None
    if isinstance(v, (int, float)):
        ms = int(v)
        from datetime import datetime, timezone
        # Feishu timestamps are ms since epoch
        try:
            dt = datetime.fromtimestamp(ms/1000, tz=timezone.utc)
            return dt.strftime("%Y-%m-%d")
        except: return None
    if isinstance(v, str):
        # already a date string
        return v[:10]
    return None

def fetch_page(offset, limit=200):
    cmd = [
        "lark-cli","base","+record-list",
        "--base-token",BASE_TOKEN,
        "--table-id",TABLE_ID,
        "--as","user",
        "--limit",str(limit),
        "--offset",str(offset),
        "--format","json",
        "--sort-json",'[{"field":"日期","desc":true}]',
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print("ERROR:", res.stderr[:500], file=sys.stderr)
        return None
    try:
        d = json.loads(res.stdout)
    except Exception as e:
        print("JSON parse error:", e, file=sys.stderr)
        return None
    return d.get("data",{})

def transform_record(rec_values, field_names):
    """rec_values is a list of cell values; field_names is the aligned list of field names."""
    f = dict(zip(field_names, rec_values))
    varieties = {}
    for sym in VARIETIES:
        score = num_val(f.get(f"{sym}_分数"))
        level = select_val(f.get(f"{sym}_档位"))
        change = num_val(f.get(f"{sym}_变化"))
        if score is not None or level is not None or change is not None:
            varieties[sym] = {"score":score,"level":level,"change":change}
    full = text_val(f.get("完整日报"))
    if len(full) > 4000:
        full = full[:4000] + "\n...(已截断)"
    return {
        "date": date_val(f.get("日期")),
        "weekday": select_val(f.get("星期")),
        "summary": text_val(f.get("今日概况")),
        "signalChange": text_val(f.get("信号变化")),
        "anomalyAlert": text_val(f.get("异常告警")),
        "dataStatus": select_val(f.get("数据状态")),
        "fullReport": full,
        "varieties": varieties,
    }

def main():
    all_records = []
    offset = 0
    limit = 200
    max_records = 30  # last 30 days
    while len(all_records) < max_records:
        page = fetch_page(offset, limit)
        if page is None:
            print("Fetch failed at offset", offset, file=sys.stderr)
            break
        records = page.get("data", [])
        field_names = page.get("fields", [])
        if not records:
            break
        for rec_values in records:
            all_records.append(transform_record(rec_values, field_names))
            if len(all_records) >= max_records:
                break
        if not page.get("has_more"):
            break
        offset += len(records)
        if len(records) < limit:
            break
    # Filter out records with no date
    all_records = [r for r in all_records if r.get("date")]
    out = {
        "source": "Feishu Base Cxvob3GdTaEX2OspVWccfnWfnje / tblBxw2GPKuZx020",
        "note": "每日从美国专业网站抓取的期货基本面日报。前端只读，需定期重新导出。",
        "exportedAt": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "recordCount": len(all_records),
        "records": all_records,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fp:
        json.dump(out, fp, ensure_ascii=False, indent=2)
    print(f"OK: wrote {len(all_records)} records to {OUT_PATH}")
    if all_records:
        print("Latest date:", all_records[0].get("date"))
        print("Oldest date:", all_records[-1].get("date"))

if __name__ == "__main__":
    main()
