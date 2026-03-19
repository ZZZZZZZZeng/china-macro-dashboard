import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface GDPDataPoint {
  date: string
  value: number
}

interface GDPData {
  indicator: string
  unit: string
  source: string
  sourceUrl: string
  updateTime: string
  description: string
  note?: string
  data: GDPDataPoint[]
}

type TimeView = 'year' | 'quarter'

// 格式化数字，保留两位小数
const fmt = (n: number) => n.toFixed(2)

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export default function GDPPage() {
  const [loading, setLoading] = useState(true)
  const [gdpData, setGdpData] = useState<GDPData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<TimeView>('year')
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 })

  useEffect(() => {
    fetchGDPData()
  }, [])

  const fetchGDPData = async () => {
    try {
      const response = await fetch('/data/gdp.json')
      if (!response.ok) throw new Error('数据获取失败')
      const data = await response.json()
      setGdpData(data)
    } catch (e) {
      setError('数据加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  const processedData = useMemo(() => {
    if (!gdpData) return { yearlyData: [], years: [], quarterlyByYear: {} }

    const yearlyMap = new Map<string, { values: number[], dates: string[] }>()
    const quarterlyByYear: Record<string, GDPDataPoint[]> = {}

    gdpData.data.forEach((item: GDPDataPoint) => {
      const year = item.date.split('-')[0]
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { values: [], dates: [] })
        quarterlyByYear[year] = []
      }
      yearlyMap.get(year)!.values.push(item.value)
      yearlyMap.get(year)!.dates.push(item.date)
      quarterlyByYear[year].push(item)
    })

    const years = Array.from(yearlyMap.keys()).sort()
    
    const yearlyData = years.map(year => {
      const data = yearlyMap.get(year)!
      const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length
      const max = Math.max(...data.values)
      const min = Math.min(...data.values)
      
      return { 
        year, 
        avg: Number(avg.toFixed(2)), 
        max, 
        min,
        quarters: data.values.length,
        maxQuarter: data.dates[data.values.indexOf(max)],
        minQuarter: data.dates[data.values.indexOf(min)]
      }
    })

    return { yearlyData, years, quarterlyByYear }
  }, [gdpData])

  const getDisplayData = useCallback(() => {
    if (!gdpData) return null

    if (view === 'year') {
      return {
        dates: processedData.yearlyData.map(d => d.year),
        yoy: processedData.yearlyData.map(d => d.avg)
      }
    }

    if (selectedYear && processedData.quarterlyByYear[selectedYear]) {
      const yearData = processedData.quarterlyByYear[selectedYear]
      return {
        dates: yearData.map(d => d.date),
        yoy: yearData.map(d => d.value)
      }
    }

    return {
      dates: gdpData.data.map(d => d.date),
      yoy: gdpData.data.map(d => d.value)
    }
  }, [gdpData, view, selectedYear, processedData])

  const calculateAxisRange = useCallback((data: number[], padding: number = 0.15) => {
    if (data.length === 0) return { min: 0, max: 10 }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const pad = range * padding
    return {
      min: Math.floor((min - pad) * 10) / 10,
      max: Math.ceil((max + pad) * 10) / 10
    }
  }, [])

  const getChartOption = useCallback((): EChartsOption => {
    const displayData = getDisplayData()
    if (!displayData) return {}

    const totalLength = displayData.dates.length
    const startIdx = Math.floor((visibleRange.start / 100) * totalLength)
    const endIdx = Math.ceil((visibleRange.end / 100) * totalLength)
    
    const visibleYoy = displayData.yoy.slice(startIdx, endIdx)
    const yoyRange = calculateAxisRange(visibleYoy.filter((v): v is number => v !== undefined))

    if (view === 'year') {
      return {
        title: {
          text: 'GDP同比增速 - 年度均值',
          left: 'center',
          top: 10,
          textStyle: { color: '#e2e8f0', fontSize: 20, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1e293b',
          borderColor: '#475569',
          textStyle: { color: '#e2e8f0', fontSize: 14 },
          formatter: (params: any) => {
            const idx = params[0].dataIndex
            const d = processedData.yearlyData[idx]
            return `<div style="padding: 10px;">
              <div style="font-weight: bold; margin-bottom: 8px; font-size: 16px;">${d.year}年</div>
              <table style="font-size: 14px;">
                <tr><td style="padding: 3px 12px 3px 0;">年均值</td><td><strong>${fmt(d.avg)}%</strong></td></tr>
                <tr><td>最高</td><td style="color:#ef4444">${fmt(d.max)}%</td></tr>
                <tr><td>最低</td><td style="color:#22c55e">${fmt(d.min)}%</td></tr>
                <tr><td>季度数</td><td>${d.quarters}个季度</td></tr>
              </table>
              <div style="margin-top: 8px; color: #94a3b8; font-size: 12px;">点击查看该年季度数据</div>
            </div>`
          }
        },
        grid: { top: 70, right: 50, bottom: 90, left: 60 },
        xAxis: {
          type: 'category',
          data: displayData.dates,
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontSize: 13, rotate: 45, interval: 0 },
          axisTick: { show: false }
        },
        yAxis: {
          type: 'value',
          name: '%',
          nameTextStyle: { color: '#94a3b8', fontSize: 14 },
          min: yoyRange.min,
          max: yoyRange.max,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 14 }
        },
        dataZoom: [
          { type: 'slider', start: visibleRange.start, end: visibleRange.end, bottom: 20, height: 28, borderColor: '#475569', backgroundColor: '#1e293b', fillerColor: 'rgba(59, 130, 246, 0.2)', textStyle: { color: '#94a3b8', fontSize: 12 } },
          { type: 'inside', start: visibleRange.start, end: visibleRange.end }
        ],
        series: [{
          type: 'bar',
          data: displayData.yoy,
          barMaxWidth: 50,
          itemStyle: {
            color: '#3b82f6',  // 统一蓝色
            borderRadius: [6, 6, 0, 0]
          },
          emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(59, 130, 246, 0.5)' } }
        }]
      }
    }

    // 季度视图 - 仅显示同比折线图
    const titleText = selectedYear ? `GDP同比增速 - ${selectedYear}年季度数据` : 'GDP同比增速 - 季度数据'

    return {
      title: {
        text: titleText,
        left: 'center',
        top: 10,
        textStyle: { color: '#e2e8f0', fontSize: 20, fontWeight: 'bold' }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1e293b',
        borderColor: '#475569',
        textStyle: { color: '#e2e8f0', fontSize: 14 },
        formatter: (params: any) => {
          const p = params[0]
          return `<div style="padding: 10px;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${p.name}</div>
            <div style="font-size: 14px;"><span style="color:#3b82f6; margin-right: 8px;">●</span>同比增速: ${fmt(p.value)}%</div>
          </div>`
        }
      },
      grid: { top: 60, right: 50, bottom: 90, left: 60 },
      xAxis: {
        type: 'category',
        data: displayData.dates,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 12, rotate: displayData.dates.length > 24 ? 45 : 0, interval: 'auto' },
        axisTick: { show: false }
      },
      yAxis: {
        type: 'value',
        name: '同比 %',
        nameTextStyle: { color: '#94a3b8', fontSize: 14 },
        min: yoyRange.min,
        max: yoyRange.max,
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#3b82f6' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 14 }
      },
      dataZoom: [
        { type: 'slider', start: visibleRange.start, end: visibleRange.end, bottom: 20, height: 28, borderColor: '#475569', backgroundColor: '#1e293b', fillerColor: 'rgba(59, 130, 246, 0.2)', textStyle: { color: '#94a3b8', fontSize: 12 }, zoomLock: false },
        { type: 'inside', start: visibleRange.start, end: visibleRange.end }
      ],
      series: [{
        name: '同比增速',
        type: 'line',
        data: displayData.yoy,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#3b82f6', width: 3 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: { 
            type: 'linear', 
            x: 0, y: 0, x2: 0, y2: 1, 
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' }, 
              { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
            ] 
          }
        }
      }]
    }
  }, [view, selectedYear, processedData, visibleRange, getDisplayData, calculateAxisRange])

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

  const onChartClick = useCallback((params: any) => {
    if (view === 'year' && params.componentType === 'series' && params.seriesType === 'bar') {
      const year = processedData.yearlyData[params.dataIndex]?.year
      if (year) {
        setSelectedYear(year)
        setView('quarter')
        setVisibleRange({ start: 0, end: 100 })
      }
    }
  }, [view, processedData.yearlyData])

  const handleViewChange = (newView: TimeView) => {
    setView(newView)
    setVisibleRange({ start: 0, end: 100 })
    if (newView === 'year') {
      setSelectedYear(null)
    }
  }

  const getStats = () => {
    if (!gdpData) return null
    const values = gdpData.data.map(d => d.value)
    const latest = values[values.length - 1]
    const latestDate = gdpData.data[gdpData.data.length - 1].date
    const latestYear = parseInt(latestDate.split('-')[0])
    const latestQuarter = latestDate.split('-')[1]
    const lastYearDate = `${latestYear - 1}-${latestQuarter}`
    const lastYearData = gdpData.data.find(d => d.date === lastYearDate)
    const yoyChange = lastYearData ? Number((latest - lastYearData.value).toFixed(2)) : null
    
    const latestCompleteYear = processedData.yearlyData.filter(d => d.quarters === 4).pop()
    
    return {
      latest,
      latestDate,
      yoyChange,
      latestCompleteYearAvg: latestCompleteYear?.avg,
      latestCompleteYear: latestCompleteYear?.year,
      max: Math.max(...values),
      min: Math.min(...values),
      maxDate: gdpData.data.find(d => d.value === Math.max(...values))?.date,
      minDate: gdpData.data.find(d => d.value === Math.min(...values))?.date,
      count: gdpData.data.length,
      yearCount: processedData.years.length
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-xl">加载中...</div></div>
  }

  if (error || !gdpData) {
    return <div className="flex items-center justify-center py-20"><div className="text-xl">{error || '加载失败'}</div></div>
  }

  const stats = getStats()!

  return (
    <>
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h2 className="font-bold text-lg">GDP同比增速</h2>
              <p className="text-slate-400 text-sm">数据来源：国家统计局 | 1992.Q1 - {stats.latestDate} ({stats.count}个季度)</p>
            </div>
          </div>
          <div className="text-sm text-slate-400">更新: {gdpData.updateTime}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">最新季度同比</div>
          <div className="text-2xl font-bold text-blue-400">{fmt(stats.latest)}%</div>
          <div className="text-slate-500 text-xs">{stats.latestDate}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">同比变化</div>
          {stats.yoyChange !== null ? (
            <>
              <div className={`text-2xl font-bold ${stats.yoyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.yoyChange >= 0 ? '+' : ''}{fmt(stats.yoyChange)}pp
              </div>
              <div className="text-slate-500 text-xs">vs 去年同期</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-slate-500">--</div>
              <div className="text-slate-500 text-xs">无去年同期数据</div>
            </>
          )}
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">{stats.latestCompleteYear}年均值</div>
          <div className="text-2xl font-bold text-blue-400">{fmt(stats.latestCompleteYearAvg!)}%</div>
          <div className="text-slate-500 text-xs">完整年度数据</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">历史最高</div>
          <div className="text-2xl font-bold text-red-400">{fmt(stats.max)}%</div>
          <div className="text-slate-500 text-xs">{stats.maxDate}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">历史最低</div>
          <div className="text-2xl font-bold text-green-400">{fmt(stats.min)}%</div>
          <div className="text-slate-500 text-xs">{stats.minDate}</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">时间维度:</span>
            <div className="flex bg-slate-700 rounded p-0.5">
              <button onClick={() => handleViewChange('year')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'year' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>年度</button>
              <button onClick={() => handleViewChange('quarter')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'quarter' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>季度</button>
            </div>
          </div>

          {view === 'quarter' && selectedYear && (
            <button onClick={() => { setSelectedYear(null); setVisibleRange({ start: 0, end: 100 }); }} className="text-sm text-blue-400 hover:text-blue-300">← 返回全部季度</button>
          )}
        </div>
        
        <div className="text-slate-500 text-sm mt-3">
          {view === 'year' && '💡 点击柱子可查看该年季度数据'}
          {view === 'quarter' && !selectedYear && '💡 GDP同比较去年同季度，消除季节性因素影响'}
          {view === 'quarter' && selectedYear && `💡 正在显示 ${selectedYear} 年的季度数据`}
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <ReactECharts 
          option={getChartOption()} 
          style={{ height: '480px' }}
          opts={{ renderer: 'canvas' }}
          onEvents={{ click: onChartClick, dataZoom: onDataZoom }}
          notMerge={true}
        />
      </div>

      <div className="bg-slate-800 rounded-lg p-4">
        <div className="text-sm text-slate-300 mb-2 font-semibold">📊 指标说明</div>
        <div className="text-sm text-slate-400">
          <div className="flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 mt-1"></span>
            <div>
              <span className="text-white">GDP同比增速</span>：与去年同季度比较，反映经济增长速度
              <div className="text-xs text-slate-500 mt-1">公式：(本年某季度 - 去年同季度) / 去年同季度 × 100%</div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          数据来自国家统计局官方发布
        </div>
      </div>
    </>
  )
}
