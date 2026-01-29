import { useState } from 'react';
import { APP_VERSION } from '../version';
import ReleaseNotes from '../components/ReleaseNotes';
import AboutModal from '../components/AboutModal';
import DocumentationModal from '../components/DocumentationModal';
import { BookOpen, Info } from 'lucide-react';

function WelcomePage() {
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  return (
    <>
      <ReleaseNotes
        isOpen={showReleaseNotes}
        onClose={() => setShowReleaseNotes(false)}
        version={APP_VERSION}
      />

      <AboutModal
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
      />

      <DocumentationModal
        isOpen={showDocs}
        onClose={() => setShowDocs(false)}
      />

      <div className="w-full min-h-[75vh] flex flex-col justify-between items-center relative">

        {/* Espaçador superior */}
        <div className="flex-grow"></div>

        {/* Conteúdo Central */}
        <div className="flex flex-col items-center justify-center flex-grow-0">
          {/* Ícone */}
          <div className="mb-6 animate-in fade-in zoom-in duration-500">
            <svg width="100" height="100" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl">
              <rect width="64" height="64" rx="16" fill="#2563EB" />
              <path d="M18 33.5L28.5 44L46 21" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Título */}
          <h1 className="text-5xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
            TestFlow
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-8 font-medium">
            Gerenciamento inteligente de qualidade
          </p>

          {/* Botões de Ação */}
          <div className="flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-700 delay-150">
            <button
              onClick={() => setShowDocs(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-neutral-700 rounded-full shadow-sm hover:shadow-md hover:border-blue-500 dark:hover:border-blue-500 transition-all font-medium group"
            >
              <BookOpen size={18} className="group-hover:text-blue-500 transition-colors" />
              Documentação
            </button>

            <button
              onClick={() => setShowAbout(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-neutral-700 rounded-full shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all font-medium group"
            >
              <Info size={18} className="group-hover:text-indigo-500 transition-colors" />
              Sobre
            </button>
          </div>
        </div>

        {/* Espaçador inferior */}
        <div className="flex-grow"></div>

        {/* Rodapé da Versão */}
        <div className="pt-8 pb-4">
          <button
            onClick={() => setShowReleaseNotes(true)}
            className="text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline transition-colors tracking-wide"
          >
            {APP_VERSION}
          </button>
        </div>

      </div>
    </>
  );
}

export default WelcomePage;