import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Importante: Este arquivo agora carrega o Tailwind

// 1. O Roteador (que ainda estamos usando)
import { MemoryRouter } from 'react-router-dom'

// 2. O ChakraProvider (que estava causando o erro) FOI REMOVIDO.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. Envolvemos o App apenas com o Roteador */}
    {/* 3. Lógica para MemoryRouter e Deep Linking seguro */}
    {(() => {
      // Verifica se é uma rota permitida explicitamente (apenas Reset Password deve funcionar via URL direta)
      const path = window.location.pathname;
      let initialEntries = ['/'];

      if (path.startsWith('/reset-password/')) {
        initialEntries = [path];
      }

      // Limpa a URL visualmente para '/'
      window.history.replaceState(null, '', '/');

      return (
        <MemoryRouter initialEntries={initialEntries}>
          <App />
        </MemoryRouter>
      );
    })()}
  </React.StrictMode>,
)