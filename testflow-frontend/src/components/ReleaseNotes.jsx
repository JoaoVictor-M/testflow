import { X, Sparkles, Zap, ShieldCheck } from 'lucide-react';

const ReleaseNotes = ({ isOpen, onClose, version }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm p-4 transition-all duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-slate-700 transition-colors">

                {/* Header Elegante */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight">O que há de novo?</h2>
                                <p className="text-blue-100 mt-2 font-medium">Confira as melhorias da versão <span className="bg-white/20 px-2 py-0.5 rounded text-white">{version}</span></p>
                            </div>
                            <button
                                onClick={onClose}
                                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-10">

                        {/* Destaque Principal */}
                        <section>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Segurança e Identidade</h3>
                                    <p className="text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                                        Melhorias na identificação do usuário em fluxos críticos.
                                    </p>
                                    <ul className="mt-3 space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <strong>Redefinição de Senha Personalizada:</strong> A tela de nova senha agora saúda o usuário pelo nome ("Olá, [Nome]"), garantindo que você está alterando a senha da conta correta.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <hr className="border-gray-100 dark:border-slate-700" />

                        {/* Visual */}
                        <section>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                                    <Sparkles size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Melhorias de Visual e Usabilidade</h3>
                                    <p className="text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                                        Refinamentos visuais para uma experiência mais fluida.
                                    </p>
                                    <ul className="mt-3 space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            <strong>Correção Visual (Flicker):</strong> Eliminamos o efeito de "piscar" indesejado ao interagir com alguns modais do sistema.
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            <strong>Estabilidade do Tema:</strong> Revertemos a implementação experimental do Modo Escuro para garantir consistência visual enquanto trabalhamos em um design Premium para a versão 1.4.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-slate-900/50 p-6 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center transition-colors">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Obrigado por utilizar o TestFlow.</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotes;
