#!/usr/bin/env python3
"""
获取A股实时行情数据
通过东方财富 API 获取数据
"""

import json
import requests
from datetime import datetime
import os

def fetch_stocks():
    """获取A股行情数据"""
    
    # 使用东方财富的公开 API（不需要认证）
    # 这个是网页端直接调用的接口，应该能用
    url = "https://push2.eastmoney.com/api/qt/clist/get"
    
    params = {
        "pn": 1,
        "pz": 500,  # 获取500条数据
        "po": 1,
        "np": 1,
        "fltt": 2,
        "invt": 2,
        "fid": "f20",  # 按市值排序
        "fs": "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23",  # A股
        "fields": "f12,f13,f14,f2,f3,f20,f21,f23,f62"
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://quote.eastmoney.com/",
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if data.get("data") and data["data"].get("diff"):
            stocks = []
            for item in data["data"]["diff"]:
                stocks.append({
                    "code": item.get("f12", ""),
                    "name": item.get("f14", ""),
                    "price": float(item.get("f2", 0) or 0),
                    "change": float(item.get("f3", 0) or 0),  # 涨跌幅
                    "marketCap": float(item.get("f20", 0) or 0),  # 总市值
                    "pe": float(item.get("f62", 0) or 0),  # 市盈率
                })
            
            result = {
                "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "count": len(stocks),
                "stocks": stocks
            }
            
            return result
        else:
            print(f"API返回异常: {data}")
            return None
            
    except Exception as e:
        print(f"获取数据失败: {e}")
        return None

def main():
    print("开始获取A股数据...")
    data = fetch_stocks()
    
    if data:
        # 保存到 public/data/stocks.json
        output_dir = "public/data"
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, "stocks.json")
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"成功保存 {data['count']} 只股票数据到 {output_path}")
        print(f"更新时间: {data['updateTime']}")
        
        # 显示前5条数据
        print("\n示例数据:")
        for stock in data["stocks"][:5]:
            print(f"  {stock['code']} {stock['name']}: ¥{stock['price']} ({stock['change']:+.2f}%)")
    else:
        print("获取数据失败")
        exit(1)

if __name__ == "__main__":
    main()
