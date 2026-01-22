import { useState } from 'react';
import { APP_VERSION } from '../version';
import ReleaseNotes from '../components/ReleaseNotes';

function WelcomePage() {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  return (
    <>
      <ReleaseNotes
        isOpen={showReleaseNotes}
        onClose={() => setShowReleaseNotes(false)}
        version={APP_VERSION}
      />
      {/* 
        --- CONTAINER ATUALIZADO ---
        Usamos min-h-[75vh] para garantir altura suficiente dentro do card pai,
        permitindo que o footer vá para o final.
      */}
      <div className="w-full min-h-[75vh] flex flex-col justify-between items-center relative">

        {/* Espaçador superior para manter o conteúdo centralizado visualmente no eixo vertical */}
        <div className="flex-grow"></div>

        {/* 
          Conteúdo Central (Ícone + Texto)
          A classe 'group' fica AQUI, para que o hover só funcione 
          quando o mouse estiver sobre o ícone/título, não na tela toda.
        */}
        <div className="flex flex-col items-center justify-center group flex-grow-0">
          {/* Ícone */}
          <svg width="80" height="80" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="12" fill="#2563EB" />
            <path d="M18 33.5L28.5 44L46 21" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>

          {/* Título */}
          <h1 className="text-4xl font-bold text-gray-800 mt-6 mb-1">
            Bem-vindo ao TestFlow
          </h1>

          {/* O texto "Sobre" que aparece no hover - dentro do grupo */}
          <div
            className="
                transition-all duration-500 ease-in-out 
                max-h-0 opacity-0
                group-hover:max-h-96
                group-hover:opacity-100
                group-hover:mt-4
                "
          >
            <p className="text-lg text-gray-600 max-w-md text-center">
              Esta ferramenta foi construída para centralizar o gerenciamento de projetos, demandas e cenários de Teste, otimizando o fluxo de trabalho da equipe de QA.
            </p>
          </div>
        </div>

        {/* Espaçador inferior para empurrar o footer */}
        <div className="flex-grow"></div>

        {/* Rodapé da Div com a Versão - FORA do group */}
        <div className="pt-8">
          <button
            onClick={() => setShowReleaseNotes(true)}
            className="text-xs text-gray-400 hover:text-blue-600 hover:underline transition-colors"
          >
            {APP_VERSION}
          </button>
        </div>

      </div>
    </>
  );
}

export default WelcomePage;