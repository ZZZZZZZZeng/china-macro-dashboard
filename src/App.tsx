import { useState } from 'react'
import M2Page from './pages/M2Page'
import GDPPage from './pages/GDPPage'

type Tab = 'm2' | 'gdp'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('m2')

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* 桌面端 */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇨🇳</span>
                <h1 className="text-lg font-bold">中国宏观经济数据看板</h1>
              </div>
              <nav className="flex items-center gap-1">
                <button 
                  onClick={() => setActiveTab('m2')}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === 'm2' 
                      ? 'bg-purple-600 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  💰 M2
                </button>
                <button 
                  onClick={() => setActiveTab('gdp')}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                    activeTab === 'gdp' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  📊 GDP
                </button>
              </nav>
            </div>
          </div>
          
          {/* 手机端 */}
          <div className="md:hidden">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-xl">🇨🇳</span>
              <h1 className="text-base font-bold">宏观经济数据看板</h1>
            </div>
            <nav className="flex items-center justify-center gap-3">
              <button 
                onClick={() => setActiveTab('m2')}
                className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'm2' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                💰 M2
              </button>
              <button 
                onClick={() => setActiveTab('gdp')}
                className={`px-8 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'gdp' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                📊 GDP
              </button>
            </nav>
          </div>
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
