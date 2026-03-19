import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const symbol = req.query.symbol || '300308'; // 默认中际旭创
  
  try {
    // 东方财富股票历史数据 API
    // 中际旭创: 300308
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?` +
      `secid=0.${symbol}&` +  // 0=深市, 1=沪市
      `fields1=f1,f2,f3,f4,f5,f6&` +
      `fields2=f51,f52,f53,f54,f55,f56,f57&` +
      `klt=101&` +  // 日K
      `fqt=1&` +    // 前复权
      `end=20500101&` +
      `lmt=5`;      // 最近5条

    console.log('Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://quote.eastmoney.com/',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // 返回数据
    res.status(200).json({
      success: true,
      symbol,
      source: 'eastmoney',
      data: data.data
    });
    
  } catch (error: any) {
    console.error('Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
