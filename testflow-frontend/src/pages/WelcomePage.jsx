import React from 'react';

function WelcomePage() {
  return (
    // --- CONTAINER ATUALIZADO ---
    // Removemos bg-white, shadow, border, etc.
    // Adicionamos 'w-full' e 'py-16' para garantir o preenchimento.
    <div className="w-full flex flex-col items-center justify-center text-center py-16 group">
      
      {/* Ícone */}
      <svg width="80" height="80" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="12" fill="#2563EB"/>
        <path d="M18 33.5L28.5 44L46 21" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      
      {/* Título */}
      <h1 className="text-4xl font-bold text-gray-800 mt-6 mb-3">
        Bem-vindo ao TestFlow
      </h1>
      
      {/* O texto "Sobre" que aparece no hover */}
      <div 
        className="
          transition-all duration-500 ease-in-out 
          max-h-0 opacity-0
          group-hover:max-h-96
          group-hover:opacity-100
          group-hover:mt-4
        "
      >
        <p className="text-lg text-gray-600 max-w-md">
          Esta ferramenta foi construída para centralizar o gerenciamento de projetos, demandas e cenários de Teste, otimizando o fluxo de trabalho da equipe de QA.
        </p>
      </div>
      
    </div>
  );
}

export default WelcomePage;