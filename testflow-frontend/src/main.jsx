import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Importante: Este arquivo agora carrega o Tailwind

// 1. O Roteador (que ainda estamos usando) - Revertendo para MemoryRouter conforme solicitação do usuário
import { MemoryRouter } from 'react-router-dom'

// Lógica de Deep Linking (Executada antes do Render)
const basePath = '/testflow';
const currentPath = window.location.pathname;
let initialEntries = ['/'];

// Verifica se é um reset de senha e captura o token
// Ex: /testflow/reset-password/TOKEN -> extrai /reset-password/TOKEN
if (currentPath.includes('/reset-password/')) {
  // Pega da parte /reset-password para frente
  const match = currentPath.substring(currentPath.indexOf('/reset-password/'));
  if (match) {
    initialEntries = [match];
  }
}

// Limpa a URL visualmente para o basePath (para não mostrar o token ou rota interna)
// Isso garante que o usuário sempre veja 'localhost/testflow' na barra de endereços
window.history.replaceState(null, '', basePath);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. Envolvemos o App apenas com o Roteador */}
    <MemoryRouter initialEntries={initialEntries}>
      <App />
    </MemoryRouter>
  </React.StrictMode>,
)