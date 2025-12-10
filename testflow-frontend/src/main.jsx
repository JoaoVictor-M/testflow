import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Importante: Este arquivo agora carrega o Tailwind

// 1. O Roteador (que ainda estamos usando)
import { BrowserRouter } from 'react-router-dom'

// 2. O ChakraProvider (que estava causando o erro) FOI REMOVIDO.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. Envolvemos o App apenas com o Roteador */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)