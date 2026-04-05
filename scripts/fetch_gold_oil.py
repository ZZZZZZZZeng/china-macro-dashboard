#!/usr/bin/env python3
"""
获取国际黄金价格和原油价格数据
通过 akshare 获取全部历史数据 (COMEX黄金 + 国际原油)
"""

import json
import os
from datetime import datetime

import akshare as ak


def fetch_gold_oil():
    """获取黄金和原油全部历史数据"""
    # 获取 COMEX 黄金期货全部历史数据
    print("获取 COMEX 黄金数据...")
    gold = ak.futures_foreign_hist(symbol="GC")
    if gold is None or gold.empty:
        print("黄金数据获取失败")
        return None

    # 获取国际原油期货全部历史数据
    print("获取国际原油数据...")
    oil = ak.futures_foreign_hist(symbol="OIL")
    if oil is None or oil.empty:
        print("原油数据获取失败")
        return None

    # 转换日期为字符串
    gold["date"] = gold["date"].astype(str)
    oil["date"] = oil["date"].astype(str)

    print(f"黄金数据: {len(gold)} 条 ({gold['date'].min()} ~ {gold['date'].max()})")
    print(f"原油数据: {len(oil)} 条 ({oil['date'].min()} ~ {oil['date'].max()})")

    # 取交集日期
    gold_dates = set(gold["date"].values)
    oil_dates = set(oil["date"].values)
    common_dates = sorted(gold_dates & oil_dates)

    print(f"交集日期: {len(common_dates)} 条 ({common_dates[0]} ~ {common_dates[-1]})")

    data = []
    for date_str in common_dates:
        gold_val = float(gold[gold["date"] == date_str]["close"].values[0])
        oil_val = float(oil[oil["date"] == date_str]["close"].values[0])

        if oil_val > 0:
            data.append({
                "date": date_str,
                "gold": round(gold_val, 2),
                "brent": round(oil_val, 2),
                "ratio": round(gold_val / oil_val, 2)
            })

    return {
        "updateTime": datetime.now().strftime("%Y-%m-%d"),
        "source": "akshare (COMEX / ICE)",
        "sourceUrl": "https://akshare.akfamily.xyz",
        "description": "国际黄金价格 (COMEX)、国际原油价格及金油比",
        "unit": "USD/oz (gold), USD/bbl (oil), ratio",
        "data": data
    }


def main():
    print("开始获取黄金和原油数据...")
    data = fetch_gold_oil()

    if data:
        output_dir = "public/data"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "gold_oil.json")

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"\n成功保存 {len(data['data'])} 条数据到 {output_path}")
        print(f"更新时间: {data['updateTime']}")

        if data["data"]:
            latest = data["data"][-1]
            print(f"\n最新数据 ({latest['date']}):")
            print(f"  黄金: ${latest['gold']}/oz")
            print(f"  原油: ${latest['brent']}/bbl")
            print(f"  金油比: {latest['ratio']}")

            first = data["data"][0]
            print(f"\n最早数据 ({first['date']}):")
            print(f"  黄金: ${first['gold']}/oz")
            print(f"  原油: ${first['brent']}/bbl")
            print(f"  金油比: {first['ratio']}")
    else:
        print("获取数据失败")
        exit(1)


if __name__ == "__main__":
    main()
