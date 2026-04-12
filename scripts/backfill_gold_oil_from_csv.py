import csv
import json
from datetime import datetime
from pathlib import Path

DATE_CANDIDATES = ["date", "日期", "day", "time"]
GOLD_PRICE_CANDIDATES = ["close", "gold", "price", "收盘", "收盘价"]
OIL_PRICE_CANDIDATES = ["brent", "oil", "close", "price", "布伦特", "收盘", "收盘价"]
GOLD_CSV_PATH = Path("/Users/mi/Downloads/archive/XAU_1d_data.csv")
OIL_CSV_PATH = Path("/Users/mi/Downloads/commodity 2000-2022.csv")
TARGET_JSON_PATH = Path("public/data/gold_oil.json")


def normalize_date(value: str) -> str:
    text = str(value).strip()
    for fmt in (
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y.%m.%d %H:%M",
    ):
        try:
            return datetime.strptime(text, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    raise ValueError(f"无法识别日期格式: {value}")


def normalize_price(value: str) -> float:
    return float(str(value).replace(",", "").strip())


def detect_date_column(headers: list[str]) -> str:
    lowered = {header.lower(): header for header in headers}
    for candidate in DATE_CANDIDATES:
        if candidate in lowered:
            return lowered[candidate]
    raise ValueError(f"未找到日期列: {headers}")


def detect_price_column(headers: list[str], dataset: str) -> str:
    lowered = {header.lower(): header for header in headers}
    candidates = GOLD_PRICE_CANDIDATES if dataset == "gold" else OIL_PRICE_CANDIDATES
    for candidate in candidates:
        if candidate in lowered:
            return lowered[candidate]
    raise ValueError(f"未找到价格列: {headers}")


def detect_delimiter(path: Path) -> str:
    first_line = path.read_text(encoding="utf-8-sig").splitlines()[0]
    return ";" if first_line.count(";") > first_line.count(",") else ","


def load_csv_prices(path: Path, dataset: str) -> dict[str, float]:
    delimiter = detect_delimiter(path)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        fieldnames = reader.fieldnames or []
        date_column = detect_date_column(fieldnames)
        price_column = detect_price_column(fieldnames, dataset=dataset)
        symbol_column = next((name for name in fieldnames if name.lower() == "symbol"), None)
        result: dict[str, float] = {}
        for row in reader:
            if dataset == "oil" and symbol_column and row[symbol_column] != "Brent Oil":
                continue
            date_key = normalize_date(row[date_column])
            result[date_key] = normalize_price(row[price_column])
        return result


def merge_missing_rows(existing_rows: list[dict], gold_prices: dict[str, float], oil_prices: dict[str, float]):
    existing_dates = {row["date"] for row in existing_rows}
    skipped_missing_oil_dates: list[str] = []
    appended_rows: list[dict] = []

    for date_key in sorted(gold_prices.keys()):
        if date_key in existing_dates:
            continue
        if date_key not in oil_prices:
            skipped_missing_oil_dates.append(date_key)
            continue

        gold_value = round(gold_prices[date_key], 2)
        oil_value = round(oil_prices[date_key], 2)
        if oil_value <= 0:
            continue

        appended_rows.append(
            {
                "date": date_key,
                "gold": gold_value,
                "brent": oil_value,
                "ratio": round(gold_value / oil_value, 2),
            }
        )

    merged_rows = sorted([*existing_rows, *appended_rows], key=lambda item: item["date"])
    summary = {
        "json_existing_dates": len(existing_dates),
        "joint_missing_dates": len(appended_rows),
        "skipped_missing_oil_dates": skipped_missing_oil_dates,
    }
    return merged_rows, summary


def load_gold_oil_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_gold_oil_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> int:
    payload = load_gold_oil_json(TARGET_JSON_PATH)
    gold_prices = load_csv_prices(GOLD_CSV_PATH, dataset="gold")
    oil_prices = load_csv_prices(OIL_CSV_PATH, dataset="oil")
    merged_rows, summary = merge_missing_rows(payload["data"], gold_prices, oil_prices)

    payload["updateTime"] = datetime.now().strftime("%Y-%m-%d")
    payload["data"] = merged_rows
    write_gold_oil_json(TARGET_JSON_PATH, payload)

    print(f"gold csv dates: {len(gold_prices)}")
    print(f"oil csv dates: {len(oil_prices)}")
    print(f"new rows added: {summary['joint_missing_dates']}")
    print(f"skipped missing oil dates: {len(summary['skipped_missing_oil_dates'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
