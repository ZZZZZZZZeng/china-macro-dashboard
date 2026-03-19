import { Outlet, NavLink } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* 桌面端：标题和导航在同一行 */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🇨🇳</span>
                <h1 className="text-lg font-bold">中国宏观经济数据看板</h1>
              </div>
              <nav className="flex items-center gap-1">
                <NavLink 
                  to="/m2" 
                  className={({ isActive }) => 
                    `px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-purple-600 text-white' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`
                  }
                >
                  💰 M2
                </NavLink>
                <NavLink 
                  to="/gdp" 
                  className={({ isActive }) => 
                    `px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`
                  }
                >
                  📊 GDP
                </NavLink>
              </nav>
            </div>
          </div>
          
          {/* 手机端：标题一行，导航一行 */}
          <div className="md:hidden">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-xl">🇨🇳</span>
              <h1 className="text-base font-bold">宏观经济数据看板</h1>
            </div>
            <nav className="flex items-center justify-center gap-2">
              <NavLink 
                to="/m2" 
                className={({ isActive }) => 
                  `px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:text-white'
                  }`
                }
              >
                💰 M2
              </NavLink>
              <NavLink 
                to="/gdp" 
                className={({ isActive }) => 
                  `px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:text-white'
                  }`
                }
              >
                📊 GDP
              </NavLink>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-4">
        <Outlet />
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
