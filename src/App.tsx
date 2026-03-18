import { useState, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'

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
  data: M2DataPoint[]
}

type TimeView = 'year' | 'month'
type ChartMetric = 'yoy' | 'mom' | 'both'

function App() {
  const [loading, setLoading] = useState(true)
  const [m2Data, setM2Data] = useState<M2Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<TimeView>('year')
  const [metric, setMetric] = useState<ChartMetric>('both')

  useEffect(() => {
    fetchM2Data()
  }, [])

  const fetchM2Data = async () => {
    try {
      const response = await fetch('https://raw.githubusercontent.com/ZZZZZZZZeng/china-macro-data/main/data/m2.json')
      if (!response.ok) throw new Error('数据获取失败')
      const data = await response.json()
      
      data.data = data.data.map((item: M2DataPoint, index: number, arr: M2DataPoint[]) => {
        if (index === 0) return { ...item, mom: 0 }
        const mom = Number((item.value - arr[index - 1].value).toFixed(2))
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
    if (!m2Data) return { yearlyData: [], years: [] }

    const yearlyMap = new Map<string, { values: number[], momValues: number[], dates: string[] }>()

    m2Data.data.forEach(item => {
      const year = item.date.split('-')[0]
      if (!yearlyMap.has(year)) {
        yearlyMap.set(year, { values: [], momValues: [], dates: [] })
      }
      yearlyMap.get(year)!.values.push(item.value)
      yearlyMap.get(year)!.momValues.push(item.mom || 0)
      yearlyMap.get(year)!.dates.push(item.date)
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

    return { yearlyData, years }
  }, [m2Data])

  // 固定的坐标轴范围
  const axisRange = useMemo(() => {
    if (!m2Data) return { yoyMin: 0, yoyMax: 40, momMin: -5, momMax: 5 }
    
    const yoyValues = m2Data.data.map(d => d.value)
    const momValues = m2Data.data.map(d => d.mom || 0)
    
    return {
      yoyMin: Math.floor(Math.min(...yoyValues) / 5) * 5 - 5,
      yoyMax: Math.ceil(Math.max(...yoyValues) / 5) * 5 + 5,
      momMin: Math.floor(Math.min(...momValues) * 2) / 2 - 1,
      momMax: Math.ceil(Math.max(...momValues) * 2) / 2 + 1
    }
  }, [m2Data])

  const getChartOption = () => {
    if (!m2Data || !m2Data.data.length) return {}

    if (view === 'year') {
      return {
        title: {
          text: 'M2增速 - 年度均值',
          left: 'center',
          top: 10,
          textStyle: { color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1e293b',
          borderColor: '#475569',
          textStyle: { color: '#e2e8f0' },
          formatter: (params: any) => {
            const idx = params[0].dataIndex
            const d = processedData.yearlyData[idx]
            return `<div style="padding: 8px;">
              <div style="font-weight: bold; margin-bottom: 6px; font-size: 14px;">${d.year}年</div>
              <table style="font-size: 12px;">
                <tr><td style="padding: 2px 8px 2px 0;">年均值</td><td><strong>${d.avg}%</strong></td></tr>
                <tr><td>最高</td><td style="color:#ef4444">${d.max}%</td></tr>
                <tr><td>最低</td><td style="color:#22c55e">${d.min}%</td></tr>
                <tr><td>年末同比</td><td>${d.end}%</td></tr>
              </table>
            </div>`
          }
        },
        grid: { top: 60, right: 30, bottom: 60, left: 50 },
        xAxis: {
          type: 'category',
          data: processedData.yearlyData.map(d => d.year),
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 },
          axisTick: { show: false }
        },
        yAxis: {
          type: 'value',
          name: '%',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          min: axisRange.yoyMin,
          max: axisRange.yoyMax,
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 }
        },
        dataZoom: [
          { type: 'slider', start: 0, end: 100, bottom: 10, height: 24, borderColor: '#475569', backgroundColor: '#1e293b', fillerColor: 'rgba(168, 85, 247, 0.2)', textStyle: { color: '#94a3b8', fontSize: 10 }, dataBackground: { lineStyle: { color: '#475569' }, areaStyle: { color: '#1e293b' } } },
          { type: 'inside', start: 0, end: 100 }
        ],
        series: [{
          type: 'bar',
          data: processedData.yearlyData.map(d => d.avg),
          barMaxWidth: 40,
          itemStyle: {
            color: (params: any) => processedData.yearlyData[params.dataIndex].yearChange >= 0 ? '#22c55e' : '#ef4444',
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(168, 85, 247, 0.5)' } }
        }]
      }
    } else {
      const allDates = m2Data.data.map(d => d.date)
      const yoyValues = m2Data.data.map(d => d.value)
      const momValues = m2Data.data.map(d => d.mom)
      
      const series: any[] = []
      
      if (metric === 'yoy' || metric === 'both') {
        series.push({
          name: '同比增速',
          type: 'line',
          yAxisIndex: 0,
          data: yoyValues,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#a855f7', width: 2 },
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
          data: momValues,
          barMaxWidth: 8,
          itemStyle: {
            color: (params: any) => params.value >= 0 ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.7)',
            borderRadius: [2, 2, 0, 0]
          }
        })
      }

      // 根据选择的指标决定Y轴配置
      const yAxisConfig: any[] = []
      
      if (metric === 'yoy' || metric === 'both') {
        yAxisConfig.push({
          type: 'value',
          name: '同比 %',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          min: axisRange.yoyMin,
          max: axisRange.yoyMax,
          position: 'left',
          axisLine: { show: true, lineStyle: { color: '#a855f7' } },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 }
        })
      }
      
      if (metric === 'mom') {
        yAxisConfig.push({
          type: 'value',
          name: '环比 pp',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          min: axisRange.momMin,
          max: axisRange.momMax,
          position: 'left',
          axisLine: { show: true, lineStyle: { color: '#22c55e' } },
          splitLine: { lineStyle: { color: '#334155', type: 'dashed' } },
          axisLabel: { color: '#94a3b8', fontSize: 11 }
        })
      }
      
      if (metric === 'both') {
        yAxisConfig.push({
          type: 'value',
          name: '环比 pp',
          nameTextStyle: { color: '#94a3b8', fontSize: 11 },
          min: axisRange.momMin,
          max: axisRange.momMax,
          position: 'right',
          axisLine: { show: true, lineStyle: { color: '#22c55e' } },
          splitLine: { show: false },
          axisLabel: { color: '#94a3b8', fontSize: 11 }
        })
      }

      return {
        title: {
          text: 'M2增速 - 月度数据',
          left: 'center',
          top: 10,
          textStyle: { color: '#e2e8f0', fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#1e293b',
          borderColor: '#475569',
          textStyle: { color: '#e2e8f0' },
          formatter: (params: any) => {
            let html = `<div style="padding: 8px;"><div style="font-weight: bold; margin-bottom: 6px;">${params[0].name}</div>`
            params.forEach((p: any) => {
              const color = p.seriesName === '同比增速' ? '#a855f7' : (p.value >= 0 ? '#22c55e' : '#ef4444')
              const unit = p.seriesName === '同比增速' ? '%' : 'pp'
              html += `<div><span style="color:${color}">${p.seriesName}</span>: ${p.value}${unit}</div>`
            })
            html += '</div>'
            return html
          }
        },
        legend: {
          show: metric === 'both',
          data: metric === 'both' ? ['同比增速', '环比变化'] : [],
          top: 35,
          textStyle: { color: '#94a3b8', fontSize: 11 }
        },
        grid: { top: metric === 'both' ? 60 : 50, right: metric === 'both' ? 50 : 30, bottom: 60, left: 50 },
        xAxis: {
          type: 'category',
          data: allDates,
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 45 },
          axisTick: { show: false }
        },
        yAxis: yAxisConfig,
        dataZoom: [
          { 
            type: 'slider', 
            start: 80,
            end: 100, 
            bottom: 10, 
            height: 24,
            borderColor: '#475569', 
            backgroundColor: '#1e293b', 
            fillerColor: 'rgba(168, 85, 247, 0.2)', 
            textStyle: { color: '#94a3b8', fontSize: 10 },
            dataBackground: { lineStyle: { color: '#475569' }, areaStyle: { color: '#1e293b' } }
          },
          { type: 'inside', startX: 80, endX: 100 }
        ],
        series
      }
    }
  }

  const getStats = () => {
    if (!m2Data) return null
    const values = m2Data.data.map(d => d.value)
    const momValues = m2Data.data.map(d => d.mom || 0)
    const latest = values[values.length - 1]
    const prev = values[values.length - 2]
    const latestMom = momValues[momValues.length - 1]
    return { 
      latest, 
      prev,
      change: Number((latest - prev).toFixed(2)),
      max: Math.max(...values), 
      min: Math.min(...values), 
      maxDate: m2Data.data.find(d => d.value === Math.max(...values))?.date,
      minDate: m2Data.data.find(d => d.value === Math.min(...values))?.date,
      latestMom,
      count: m2Data.data.length
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">加载中...</div></div>
  }

  if (error || !m2Data) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">{error || '加载失败'}</div></div>
  }

  const stats = getStats()!

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 顶部标题栏 */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🇨🇳</span>
            <h1 className="text-lg font-bold">中国宏观经济数据看板</h1>
          </div>
          <div className="text-sm text-slate-400">
            数据更新: {m2Data.updateTime}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* 指标标题 */}
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <h2 className="font-bold text-lg">M2广义货币供应量增速</h2>
                <p className="text-slate-400 text-sm">数据来源：中国人民银行 | 1991.01 - 2026.02 ({stats.count}个月)</p>
              </div>
            </div>
            <a 
              href="https://github.com/ZZZZZZZZeng/china-macro-data" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-slate-400 hover:text-white px-3 py-1.5 bg-slate-700 rounded"
            >
              📊 数据源
            </a>
          </div>
        </div>

        {/* 核心指标卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">最新同比</div>
            <div className="text-2xl font-bold">{stats.latest}%</div>
            <div className="text-slate-500 text-xs">2026年2月</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">环比变化</div>
            <div className={`text-2xl font-bold ${stats.latestMom! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {stats.latestMom! >= 0 ? '+' : ''}{stats.latestMom}pp
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

        {/* 图表控制面板 */}
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* 时间维度 */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">时间维度:</span>
              <div className="flex bg-slate-700 rounded p-0.5">
                <button
                  onClick={() => setView('year')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${view === 'year' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  年度
                </button>
                <button
                  onClick={() => setView('month')}
                  className={`px-3 py-1 text-sm rounded transition-colors ${view === 'month' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  月度
                </button>
              </div>
            </div>

            {/* 显示指标 - 仅月度视图可用 */}
            {view === 'month' && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">显示指标:</span>
                <div className="flex bg-slate-700 rounded p-0.5">
                  <button
                    onClick={() => setMetric('both')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${metric === 'both' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    同比+环比
                  </button>
                  <button
                    onClick={() => setMetric('yoy')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${metric === 'yoy' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    仅同比
                  </button>
                  <button
                    onClick={() => setMetric('mom')}
                    className={`px-3 py-1 text-sm rounded transition-colors ${metric === 'mom' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    仅环比
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 图表 */}
        <div className="bg-slate-800 rounded-lg p-4 mb-4">
          <ReactECharts 
            option={getChartOption()} 
            style={{ height: '450px' }}
            opts={{ renderer: 'canvas' }}
          />
        </div>

        {/* 说明 */}
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex gap-6 text-sm text-slate-400">
            <div><span className="text-purple-400">● 同比增速</span>: 与去年同月比较</div>
            <div><span className="text-green-400">● 环比变化</span>: 与上月比较 (单位: pp即百分点)</div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
