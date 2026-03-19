import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'

interface M2DataPoint {
  date: string
  value: number
  mom?: number
}

interface M2Data {
  indicator: string
  unit: string
  source: string
  sourceUrl: string
  updateTime: string
  description: string
  note?: string
  data: M2DataPoint[]
}

type TimeView = 'year' | 'month'
type ChartMetric = 'both' | 'yoy' | 'mom'

function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }) as T
}

export default function M2Page() {
  const [loading, setLoading] = useState(true)
  const [m2Data, setM2Data] = useState<M2Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<TimeView>('year')
  const [metric, setMetric] = useState<ChartMetric>('both')
  const [selectedYear, setSelectedYear] = useState<string | null>(null)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 })

  useEffect(() => {
    fetchM2Data()
  }, [])

  const fetchM2Data = async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/ZZZZZZZZeng/china-macro-data/main/data/m2.json')
      if (!response.ok) throw new Error('数据获取失败')
      const data = await response.json()
      
      data.data = data.data.map((item: M2DataPoint, index: number) => {
        if (index === 0) {
          return { ...item, mom: 0 }
        }
        const prevValue = data.data[index - 1].value
        const mom = Number((item.value - prevValue).toFixed(2))
        return { ...item, mom }
      })
      
      setM2Data(data)
    } catch (e) {
      setError('数据加载失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  const processedData = useMemo(() => {
    if (!m2Data) return { yearlyData: [], years: [], monthlyByYear: {} }

    const yearlyMap = new Map<string, { values: number[], momValues: number[], dates: string[] }>()
    const monthlyByYear: Record<string, M2DataPoint[]> = {}

    m2Data.data.forEach((item: M2DataPoint) => {
      const year = item.date.split('-')[0]
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { values: [], momValues: [], dates: [] })
        monthlyByYear[year] = []
      }
      yearlyMap.get(year)!.values.push(item.value)
      yearlyMap.get(year)!.momValues.push(item.mom || 0)
      yearlyMap.get(year)!.dates.push(item.date)
      monthlyByYear[year].push(item)
    })

    const years = Array.from(yearlyMap.keys()).sort()
    
    const yearlyData = years.map(year => {
      const data = yearlyMap.get(year)!
      const avg = data.values.reduce((a, b) => a + b, 0) / data.values.length
      const max = Math.max(...data.values)
      const min = Math.min(...data.values)
      const start = data.values[0]
      const end = data.values[data.values.length - 1]
      const yearChange = Number((end - start).toFixed(2))
      const momSum = data.momValues.reduce((a, b) => a + b, 0)
      
      return { year, avg: Number(avg.toFixed(2)), max, min, start, end, yearChange, momSum: Number(momSum.toFixed(2)) }
    })

    return { yearlyData, years, monthlyByYear }
  }, [m2Data])

  const getDisplayData = useCallback(() => {
    if (!m2Data) return null

    if (view === 'year') {
      return {
        dates: processedData.yearlyData.map(d => d.year),
        yoy: processedData.yearlyData.map(d => d.avg),
        mom: processedData.yearlyData.map(d => d.momSum)
      }
    }

    if (selectedYear && processedData.monthlyByYear[selectedYear]) {
      const yearData = processedData.monthlyByYear[selectedYear]
      return {
        dates: yearData.map(d => d.date),
        yoy: yearData.map(d => d.value),
        mom: yearData.map(d => d.mom || 0)
      }
    }

    return {
      dates: m2Data.data.map(d => d.date),
      yoy: m2Data.data.map(d => d.value),
      mom: m2Data.data.map(d => d.mom || 0)
    }
  }, [m2Data, view, selectedYear, processedData])

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
    const visibleMom = displayData.mom.slice(startIdx, endIdx)

    const yoyRange = calculateAxisRange(visibleYoy.filter((v): v is number => v !== undefined))
    const momRange = calculateAxisRange(visibleMom.filter((v): v is number => v !== undefined))

    if (view === 'year') {
      return {
        title: {
          text: 'M2增速 - 年度均值',
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
                <tr><td style="padding: 3px 12px 3px 0;">年均值</td><td><strong>${d.avg}%</strong></td></tr>
                <tr><td>最高</td><td style="color:#ef4444">${d.max}%</td></tr>
                <tr><td>最低</td><td style="color:#22c55e">${d.min}%</td></tr>
              </table>
              <div style="margin-top: 8px; color: #94a3b8; font-size: 12px;">点击查看该年月度数据</div>
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
          { type: 'slider', start: visibleRange.start, end: visibleRange.end, bottom: 20, height: 28, borderColor: '#475569', backgroundColor: '#1e293b', fillerColor: 'rgba(168, 85, 247, 0.2)', textStyle: { color: '#94a3b8', fontSize: 12 } },
          { type: 'inside', start: visibleRange.start, end: visibleRange.end }
        ],
        series: [{
          type: 'bar',
          data: displayData.yoy,
          barMaxWidth: 50,
          itemStyle: {
            color: (params: any) => processedData.yearlyData[params.dataIndex]?.yearChange >= 0 ? '#22c55e' : '#ef4444',
            borderRadius: [6, 6, 0, 0]
          },
          emphasis: { itemStyle: { shadowBlur: 15, shadowColor: 'rgba(168, 85, 247, 0.5)' } }
        }]
      }
    }

    const series: any[] = []
    const yAxisConfig: any[] = []

    if (metric === 'yoy' || metric === 'both') {
      series.push({
        name: '同比增速',
        type: 'line',
        yAxisIndex: 0,
        data: displayData.yoy,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#a855f7', width: 3 },
        itemStyle: { color: '#a855f7' },
        areaStyle: metric === 'yoy' ? {
          color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(168, 85, 247, 0.3)' }, { offset: 1, color: 'rgba(168, 85, 247, 0.0)' }] }
        } : undefined
      })
    }

    if (metric === 'mom' || metric === 'both') {
      series.push({
        name: '环比变化',
        type: 'bar',
        yAxisIndex: metric === 'both' ? 1 : 0,
        data: displayData.mom,
        barMaxWidth: 12,
        itemStyle: {
          color: (params: any) => params.value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
          borderRadius: [2, 2, 0, 0]
        },
        progressive: 200,
        progressiveThreshold: 300
      })
    }

    if (metric === 'yoy' || metric === 'both') {
      yAxisConfig.push({
        type: 'value',
        name: '同比 %',
        nameTextStyle: { color: '#94a3b8', fontSize: 14 },
        min: yoyRange.min,
        max: yoyRange.max,
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#a855f7' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 14 }
      })
    }

    if (metric === 'mom') {
      yAxisConfig.push({
        type: 'value',
        name: '环比 %',
        nameTextStyle: { color: '#94a3b8', fontSize: 14 },
        min: momRange.min,
        max: momRange.max,
        position: 'left',
        axisLine: { show: true, lineStyle: { color: '#22c55e' } },
        splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
        axisLabel: { color: '#94a3b8', fontSize: 14 }
      })
    }

    if (metric === 'both') {
      yAxisConfig.push({
        type: 'value',
        name: '环比 %',
        nameTextStyle: { color: '#94a3b8', fontSize: 14 },
        min: momRange.min,
        max: momRange.max,
        position: 'right',
        axisLine: { show: true, lineStyle: { color: '#22c55e' } },
        splitLine: { show: false },
        axisLabel: { color: '#94a3b8', fontSize: 14 }
      })
    }

    const titleText = selectedYear ? `M2增速 - ${selectedYear}年月度数据` : 'M2增速 - 月度数据'

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
          let html = `<div style="padding: 10px;"><div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${params[0].name}</div>`
          params.forEach((p: any) => {
            const color = p.seriesName === '同比增速' ? '#a855f7' : (p.value >= 0 ? '#22c55e' : '#ef4444')
            html += `<div style="font-size: 14px;"><span style="color:${color}; margin-right: 8px;">●</span>${p.seriesName}: ${p.value}%</div>`
          })
          html += '</div>'
          return html
        }
      },
      legend: {
        show: metric === 'both',
        data: metric === 'both' ? ['同比增速', '环比变化'] : [],
        top: 40,
        textStyle: { color: '#94a3b8', fontSize: 14 }
      },
      grid: { top: metric === 'both' ? 70 : 60, right: metric === 'both' ? 60 : 50, bottom: 90, left: 60 },
      xAxis: {
        type: 'category',
        data: displayData.dates,
        axisLine: { lineStyle: { color: '#475569' } },
        axisLabel: { color: '#94a3b8', fontSize: 12, rotate: displayData.dates.length > 24 ? 45 : 0, interval: 'auto' },
        axisTick: { show: false }
      },
      yAxis: yAxisConfig,
      dataZoom: [
        { type: 'slider', start: visibleRange.start, end: visibleRange.end, bottom: 20, height: 28, borderColor: '#475569', backgroundColor: '#1e293b', fillerColor: 'rgba(168, 85, 247, 0.2)', textStyle: { color: '#94a3b8', fontSize: 12 }, zoomLock: false },
        { type: 'inside', start: visibleRange.start, end: visibleRange.end }
      ],
      series
    }
  }, [view, metric, selectedYear, processedData, visibleRange, getDisplayData, calculateAxisRange])

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
        setView('month')
        setMetric('both')
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
    if (!m2Data) return null
    const values = m2Data.data.map(d => d.value)
    const momValues = m2Data.data.map(d => d.mom || 0)
    const latest = values[values.length - 1]
    const latestMom = momValues[momValues.length - 1]
    return {
      latest,
      latestMom,
      max: Math.max(...values),
      min: Math.min(...values),
      maxDate: m2Data.data.find(d => d.value === Math.max(...values))?.date,
      minDate: m2Data.data.find(d => d.value === Math.min(...values))?.date,
      count: m2Data.data.length
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="text-xl">加载中...</div></div>
  }

  if (error || !m2Data) {
    return <div className="flex items-center justify-center py-20"><div className="text-xl">{error || '加载失败'}</div></div>
  }

  const stats = getStats()!

  return (
    <>
      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💰</span>
            <div>
              <h2 className="font-bold text-lg">M2广义货币供应量增速</h2>
              <p className="text-slate-400 text-sm">数据来源：中国人民银行 | 1991.01 - 2026.02 ({stats.count}个月)</p>
            </div>
          </div>
          <div className="text-sm text-slate-400">更新: {m2Data.updateTime}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">最新同比</div>
          <div className="text-2xl font-bold">{stats.latest}%</div>
          <div className="text-slate-500 text-xs">2026年2月</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">环比变化</div>
          <div className={`text-2xl font-bold ${stats.latestMom! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.latestMom! >= 0 ? '+' : ''}{stats.latestMom}%
          </div>
          <div className="text-slate-500 text-xs">较上月</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">历史最高</div>
          <div className="text-2xl font-bold text-red-400">{stats.max}%</div>
          <div className="text-slate-500 text-xs">{stats.maxDate}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">历史最低</div>
          <div className="text-2xl font-bold text-green-400">{stats.min}%</div>
          <div className="text-slate-500 text-xs">{stats.minDate}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3">
          <div className="text-slate-400 text-xs mb-1">统计周期</div>
          <div className="text-2xl font-bold text-purple-400">35年</div>
          <div className="text-slate-500 text-xs">1991-2026</div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">时间维度:</span>
            <div className="flex bg-slate-700 rounded p-0.5">
              <button onClick={() => handleViewChange('year')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'year' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>年度</button>
              <button onClick={() => handleViewChange('month')} className={`px-4 py-1.5 text-sm rounded transition-colors ${view === 'month' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>月度</button>
            </div>
          </div>

          {view === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">显示指标:</span>
              <div className="flex bg-slate-700 rounded p-0.5">
                <button onClick={() => setMetric('both')} className={`px-3 py-1.5 text-sm rounded transition-colors ${metric === 'both' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>同比+环比</button>
                <button onClick={() => setMetric('yoy')} className={`px-3 py-1.5 text-sm rounded transition-colors ${metric === 'yoy' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>仅同比</button>
                <button onClick={() => setMetric('mom')} className={`px-3 py-1.5 text-sm rounded transition-colors ${metric === 'mom' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>仅环比</button>
              </div>
            </div>
          )}

          {view === 'month' && selectedYear && (
            <button onClick={() => { setSelectedYear(null); setVisibleRange({ start: 0, end: 100 }); }} className="text-sm text-purple-400 hover:text-purple-300">← 返回全部月度</button>
          )}
        </div>
        
        <div className="text-slate-500 text-sm mt-3">
          {view === 'year' && '💡 点击柱子可查看该年月度数据'}
          {view === 'month' && !selectedYear && '💡 环比变化 = 本月同比增速 - 上月同比增速'}
          {view === 'month' && selectedYear && `💡 正在显示 ${selectedYear} 年的月度数据`}
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
        <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-400">
          <div className="flex items-start gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500 mt-1"></span>
            <div>
              <span className="text-white">同比增速</span>：与去年同月比较，反映长期趋势
              <div className="text-xs text-slate-500 mt-1">公式：(本年某月 - 去年同月) / 去年同月 × 100%</div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-3 h-3 rounded bg-green-500 mt-1"></span>
            <div>
              <span className="text-white">环比变化</span>：同比增速的月度变化，反映短期动能
              <div className="text-xs text-slate-500 mt-1">公式：本月同比增速 - 上月同比增速</div>
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          数据完全来自中国人民银行官方统计，环比变化基于官方同比数据计算
        </div>
      </div>
    </>
  )
}
