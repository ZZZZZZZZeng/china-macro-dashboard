import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface GoldOilDataPoint {
  date: string
  gold: number
  brent: number
  ratio: number
}

interface GoldOilData {
  updateTime: string
  source: string
  sourceUrl: string
  description: string
  unit: string
  data: GoldOilDataPoint[]
}

type TimeView = 'day' | 'month' | 'year'

// 格式化数字，保留两位小数
const fmt = (n: number) => n.toFixed(2)

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export default function GoldOilPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<GoldOilData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<TimeView>('day')
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      let response = await fetch('/data/gold_oil.json')
      if (!response.ok) {
        response = await fetch('https://raw.githubusercontent.com/ZZZZZZZZeng/china-macro-data/main/data/gold_oil.json')
      }
      if (!response.ok) throw new Error('数据获取失败')
      const jsonData = await response.json()
      setData(jsonData)
    } catch (e) {
      setError('数据加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  // 按时间维度聚合数据
  const processedData = useMemo(() => {
    if (!data) return { day: [], month: [], year: [] as GoldOilDataPoint[] }

    const day = data.data

    // 月度：每月最后一天的数据
    const monthMap = new Map<string, GoldOilDataPoint>()
    for (const d of data.data) {
      const key = d.date.slice(0, 7) // YYYY-MM
      monthMap.set(key, d)
    }
    const month = Array.from(monthMap.values())

    // 年度：每年最后一天的数据
    const yearMap = new Map<string, GoldOilDataPoint>()
    for (const d of data.data) {
      const key = d.date.slice(0, 4) // YYYY
      yearMap.set(key, d)
    }
    const year = Array.from(yearMap.values())

    return { day, month, year }
  }, [data])

  // 当前视图下的显示数据
  const displayData = useMemo(() => {
    return processedData[view]
  }, [processedData, view])

  const calculateAxisRange = useCallback((values: number[], padding: number = 0.15) => {
    if (values.length === 0) return { min: 0, max: 10 }
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const pad = range * padding
    return {
      min: Math.floor((min - pad) * 10) / 10,
      max: Math.ceil((max + pad) * 10) / 10
    }
  }, [])

  const getVisibleSlice = useCallback(() => {
    const totalLength = displayData.length
    if (totalLength === 0) return { dates: [], gold: [], brent: [], ratio: [] }
    const startIdx = Math.floor((visibleRange.start / 100) * totalLength)
    const endIdx = Math.ceil((visibleRange.end / 100) * totalLength)
    const slice = displayData.slice(startIdx, endIdx)
    return {
      dates: slice.map(d => d.date),
      gold: slice.map(d => d.gold),
      brent: slice.map(d => d.brent),
      ratio: slice.map(d => d.ratio)
    }
  }, [displayData, visibleRange])

  const buildChartOption = useCallback((
    title: string,
    seriesData: number[],
    dates: string[],
    color: string,
    unit: string,
    smooth: boolean = true
  ): EChartsOption => {
    const range = calculateAxisRange(seriesData)
    return {
      title: {
        text: title,
        left: 'center',
        top: 10,
        textStyle: { color: '#e2e8f0', fontSize: 18, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#e2e8f0', fontSize: 14 },
        formatter: (params: any) => {
          const p = params[0]
          return `<div style="padding: 8px;">
            <div style="font-weight: bold; margin-bottom: 4px;">${p.name}</div>
            <div style="font-size: 14px;"><span style="color:${color}; margin-right: 6px;">●</span>${title.split(' ')[0]}: ${fmt(p.value)} ${unit}</div>
          </div>`
        }
      },
      grid: { top: 60, right: 50, bottom: 90, left: 60 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 11, rotate: dates.length > 60 ? 45 : 0, interval: 'auto' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { color: '#94a3b8', fontSize: 13 },
        min: range.min,
        max: range.max,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 13 }
      },
      dataZoom: [
        { type: 'slider', start: visibleRange.start, end: visibleRange.end, bottom: 20, height: 28, borderColor: '#475569', backgroundColor: '#1e293b', fillerColor: `${color}33`, textStyle: { color: '#94a3b8', fontSize: 12 } },
        { type: 'inside', start: visibleRange.start, end: visibleRange.end }
      ],
      series: [{
        type: 'line',
        data: seriesData,
        smooth,
        symbol: view === 'year' ? 'circle' : 'none',
        symbolSize: view === 'year' ? 6 : 4,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${color}4D` },
              { offset: 1, color: `${color}00` }
            ]
          }
        }
      }]
    }
  }, [calculateAxisRange, visibleRange, view])

  const debouncedSetVisibleRange = useRef(
    debounce((start: number, end: number) => {
      setVisibleRange({ start, end })
    }, 30)
  ).current

  const onDataZoom = useCallback((params: any) => {
    if (params.batch) {
      const { start, end } = params.batch[0]
      debouncedSetVisibleRange(start, end)
    } else if (params.start !== undefined && params.end !== undefined) {
      debouncedSetVisibleRange(params.start, params.end)
    }
  }, [debouncedSetVisibleRange])

  const handleViewChange = (newView: TimeView) => {
    setView(newView)
    setVisibleRange({ start: 0, end: 100 })
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-xl">加载中...</div></div>
  }

  if (error || !data) {
    return <div className="flex items-center justify-center py-20"><div className="text-xl">{error || '加载失败'}</div></div>
  }

  const latest = data.data[data.data.length - 1]
  const prev = data.data.length > 1 ? data.data[data.data.length - 2] : null
  const goldChange = prev ? latest.gold - prev.gold : 0
  const brentChange = prev ? latest.brent - prev.brent : 0
  const ratioChange = prev ? latest.ratio - prev.ratio : 0

  const goldValues = data.data.map(d => d.gold)
  const ratioValues = data.data.map(d => d.ratio)

  const visible = getVisibleSlice()

  return (
    <>
      {/* 头部信息 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥇</span>
            <div>
              <h2 className="font-bold text-lg">金油比追踪</h2>
              <p className="text-slate-400 text-sm">数据来源：akshare (COMEX/ICE) | {data.data[0].date} ~ {latest.date} ({data.data.length}个交易日)</p>
            </div>
          </div>
          <div className="text-sm text-slate-400">更新: {data.updateTime}</div>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">最新黄金价格</div>
          <div className="text-2xl font-bold text-amber-400">${fmt(latest.gold)}</div>
          <div className={`text-xs ${goldChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {goldChange >= 0 ? '+' : ''}{fmt(goldChange)}/oz
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">最新Brent价格</div>
          <div className="text-2xl font-bold text-slate-300">${fmt(latest.brent)}</div>
          <div className={`text-xs ${brentChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {brentChange >= 0 ? '+' : ''}{fmt(brentChange)}/bbl
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">最新金油比</div>
          <div className="text-2xl font-bold text-red-400">{fmt(latest.ratio)}</div>
          <div className={`text-xs ${ratioChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {ratioChange >= 0 ? '+' : ''}{fmt(ratioChange)}
          </div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">黄金区间最高</div>
          <div className="text-2xl font-bold text-red-400">${fmt(Math.max(...goldValues))}</div>
          <div className="text-slate-500 text-xs">{data.data[goldValues.indexOf(Math.max(...goldValues))].date}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">黄金区间最低</div>
          <div className="text-2xl font-bold text-green-400">${fmt(Math.min(...goldValues))}</div>
          <div className="text-slate-500 text-xs">{data.data[goldValues.indexOf(Math.min(...goldValues))].date}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">金油比区间均值</div>
          <div className="text-2xl font-bold text-purple-400">{fmt(ratioValues.reduce((a, b) => a + b, 0) / ratioValues.length)}</div>
          <div className="text-slate-500 text-xs">近{ratioValues.length}个交易日</div>
        </div>
      </div>

      {/* 时间维度切换 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">时间维度:</span>
          <div className="flex bg-slate-700 rounded p-0.5">
            <button onClick={() => handleViewChange('day')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'day' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>日度</button>
            <button onClick={() => handleViewChange('month')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'month' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>月度</button>
            <button onClick={() => handleViewChange('year')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'year' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>年度</button>
          </div>
          <span className="text-slate-500 text-xs ml-2">
            当前显示 {displayData.length} 个数据点
          </span>
        </div>
      </div>

      {/* 黄金价格折线图 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <ReactECharts
          option={buildChartOption('国际黄金价格 (COMEX)', visible.gold, visible.dates, '#f59e0b', 'USD/oz')}
          style={{ height: '360px' }}
          opts={{ renderer: 'canvas' }}
          onEvents={{ dataZoom: onDataZoom }}
          notMerge={true}
        />
      </div>

      {/* Brent原油价格折线图 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <ReactECharts
          option={buildChartOption('Brent 原油价格', visible.brent, visible.dates, '#64748b', 'USD/bbl')}
          style={{ height: '360px' }}
          opts={{ renderer: 'canvas' }}
          onEvents={{ dataZoom: onDataZoom }}
          notMerge={true}
        />
      </div>

      {/* 金油比折线图 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <ReactECharts
          option={buildChartOption('金油比 (Gold / Oil Ratio)', visible.ratio, visible.dates, '#ef4444', '倍', true)}
          style={{ height: '360px' }}
          opts={{ renderer: 'canvas' }}
          onEvents={{ dataZoom: onDataZoom }}
          notMerge={true}
        />
      </div>

      {/* 指标说明 */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="text-sm text-slate-300 mb-2 font-semibold">📊 指标说明</div>
        <div className="text-sm text-slate-400 space-y-2">
          <div className="flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-500 mt-1"></span>
            <div>
              <span className="text-white">国际黄金价格</span>：COMEX黄金期货价格，美元/盎司
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-500 mt-1"></span>
            <div>
              <span className="text-white">Brent原油价格</span>：ICE布伦特原油期货价格，美元/桶
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500 mt-1"></span>
            <div>
              <span className="text-white">金油比</span> = 黄金价格 / 原油价格
              <div className="text-xs text-slate-500 mt-1">历史均值约 15-16 倍。高于 25 倍通常被视为经济衰退预警信号</div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          数据来自 akshare (COMEX/ICE)，每个交易日更新
        </div>
      </div>
    </>
  )
}
