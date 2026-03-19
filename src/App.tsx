import { useState } from 'react'
import M2Page from './pages/M2Page'
import GDPPage from './pages/GDPPage'

type Tab = 'm2' | 'gdp'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('m2')

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          {/* 标题 */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">🇨🇳</span>
            <h1 className="text-lg font-bold">中国宏观经济数据看板</h1>
          </div>
          
          {/* 导航按钮 - 始终显示 */}
          <nav className="flex items-center justify-center gap-4">
            <button 
              onClick={() => setActiveTab('m2')}
              className={`px-10 py-3 rounded-xl text-base font-bold transition-all ${
                activeTab === 'm2' 
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              💰 M2 货币供应量
            </button>
            <button 
              onClick={() => setActiveTab('gdp')}
              className={`px-10 py-3 rounded-xl text-base font-bold transition-all ${
                activeTab === 'gdp' 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              📊 GDP 国内生产总值
            </button>
          </nav>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-4">
        {activeTab === 'm2' ? <M2Page /> : <GDPPage />}
      </main>
      
      <footer className="border-t border-slate-800 py-4 mt-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-500 text-sm">
          数据来源：中国人民银行、国家统计局 | 
          <a href="https://github.com/ZZZZZZZZeng/china-macro-data" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 ml-1">📊 数据仓库</a>
        </div>
      </footer>
    </div>
  )
}

export default App
