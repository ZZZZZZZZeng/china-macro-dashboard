import json
import tempfile
import unittest
from pathlib import Path

from scripts.backfill_gold_oil_from_csv import (
    detect_date_column,
    detect_price_column,
    load_csv_prices,
    merge_missing_rows,
    normalize_date,
    normalize_price,
    write_gold_oil_json,
)


class NormalizeHelpersTest(unittest.TestCase):
    def test_normalize_date_supports_iso_and_slash_formats(self):
        self.assertEqual(normalize_date("2020-01-02"), "2020-01-02")
        self.assertEqual(normalize_date("2020/1/2"), "2020-01-02")
        self.assertEqual(normalize_date("2020/01/02 00:00:00"), "2020-01-02")
        self.assertEqual(normalize_date("2004.06.11 00:00"), "2004-06-11")

    def test_normalize_price_strips_commas(self):
        self.assertEqual(normalize_price("1,234.56"), 1234.56)
        self.assertEqual(normalize_price("78.9"), 78.9)


class CsvColumnDetectionTest(unittest.TestCase):
    def test_detect_date_column(self):
        headers = ["Date", "Open", "Close"]
        self.assertEqual(detect_date_column(headers), "Date")

    def test_detect_gold_price_column_prefers_close(self):
        headers = ["Date", "Open", "High", "Low", "Close"]
        self.assertEqual(detect_price_column(headers, dataset="gold"), "Close")

    def test_detect_oil_price_column_accepts_brent_aliases(self):
        headers = ["日期", "布伦特", "成交量"]
        self.assertEqual(detect_price_column(headers, dataset="oil"), "布伦特")


class CsvLoadingTest(unittest.TestCase):
    def test_load_csv_prices_supports_semicolon_gold_file(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "gold.csv"
            path.write_text(
                "Date;Open;High;Low;Close;Volume\n2004.06.11 00:00;384;384.8;382.8;384.1;272\n",
                encoding="utf-8",
            )

            prices = load_csv_prices(path, dataset="gold")

        self.assertEqual(prices, {"2004-06-11": 384.1})

    def test_load_csv_prices_filters_brent_oil_rows(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            path = Path(tmp_dir) / "commodity.csv"
            path.write_text(
                "Symbol,Date,Open,High,Low,Close,Volume\n"
                "Gold,2000-01-04,281.0,281.0,281.0,282.7,4\n"
                "Brent Oil,2000-01-05,23.9,24.7,23.89,24.39,32509\n",
                encoding="utf-8",
            )

            prices = load_csv_prices(path, dataset="oil")

        self.assertEqual(prices, {"2000-01-05": 24.39})


class MergeMissingRowsTest(unittest.TestCase):
    def test_merge_missing_rows_adds_only_dates_missing_in_json(self):
        existing = [
            {"date": "2020-01-02", "gold": 1520.0, "brent": 66.0, "ratio": 23.03},
        ]
        gold_prices = {
            "2020-01-02": 9999.0,
            "2020-01-03": 1535.0,
            "2020-01-04": 1540.0,
        }
        oil_prices = {
            "2020-01-03": 68.0,
        }

        merged, summary = merge_missing_rows(existing, gold_prices, oil_prices)

        self.assertEqual(len(merged), 2)
        self.assertEqual(
            merged[-1],
            {
                "date": "2020-01-03",
                "gold": 1535.0,
                "brent": 68.0,
                "ratio": 22.57,
            },
        )
        self.assertEqual(summary["json_existing_dates"], 1)
        self.assertEqual(summary["joint_missing_dates"], 1)
        self.assertEqual(summary["skipped_missing_oil_dates"], ["2020-01-04"])


class JsonWriteTest(unittest.TestCase):
    def test_write_gold_oil_json_preserves_metadata_and_updates_rows(self):
        payload = {
            "updateTime": "2026-04-05",
            "source": "akshare (COMEX / ICE)",
            "sourceUrl": "https://akshare.akfamily.xyz",
            "description": "国际黄金价格 (COMEX)、国际原油价格及金油比",
            "unit": "USD/oz (gold), USD/bbl (oil), ratio",
            "data": [{"date": "2020-01-03", "gold": 1535.0, "brent": 68.0, "ratio": 22.57}],
        }

        with tempfile.TemporaryDirectory() as tmp_dir:
            target = Path(tmp_dir) / "gold_oil.json"
            write_gold_oil_json(target, payload)
            loaded = json.loads(target.read_text(encoding="utf-8"))

        self.assertEqual(loaded["source"], payload["source"])
        self.assertEqual(loaded["data"][0]["date"], "2020-01-03")


if __name__ == "__main__":
    unittest.main()
