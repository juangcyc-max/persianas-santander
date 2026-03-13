import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Header from './shared/Header'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Configurator from './pages/Configurator'
import MisConfiguraciones from './pages/components/MisConfiguraciones'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 w-full">
        {/* Header en todas las páginas */}
        <Header />
        
        {/* Contenido de las páginas - Full Width */}
        <main className="w-full">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/configurador" element={<Configurator />} />
            <Route path="/mis-configuraciones" element={<MisConfiguraciones />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App