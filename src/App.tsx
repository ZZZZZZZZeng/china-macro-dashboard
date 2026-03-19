import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import M2Page from './pages/M2Page'
import GDPPage from './pages/GDPPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/m2" replace />} />
          <Route path="m2" element={<M2Page />} />
          <Route path="gdp" element={<GDPPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
