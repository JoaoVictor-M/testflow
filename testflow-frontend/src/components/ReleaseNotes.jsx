import { Sparkles, ShieldCheck, Link, Mail } from 'lucide-react';

const ReleaseNotes = ({ isOpen, onClose, version }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm p-4 transition-all duration-300">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-neutral-700 transition-colors">

                {/* Header Elegante */}
                <div className="bg-gradient-to-r from-blue-700 to-blue-600 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight">O que há de novo?</h2>
                                <p className="text-blue-100 mt-2 font-medium">Confira as novidades da versão <span className="bg-white/20 px-2 py-0.5 rounded text-white">{version}</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-12">

                        {/* Configurações de Sistema */}
                        <section>
                            <div className="flex items-start gap-5">
                                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                                    <Sparkles size={28} />
                                </div>
                                <div className="space-y-6 w-full">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Melhorias Gerais</h3>
                                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                                            Aprimoramentos na estabilidade e navegação do sistema.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="pl-4 border-l-2 border-blue-500/30 dark:border-blue-400/30">
                                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Atualização de URL</h4>
                                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-0.5">Endereço simplificado</p>
                                            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm leading-relaxed">
                                                Agora você acessa o TestFlow de forma mais limpa e direta em <strong>/testflow</strong>, sem números de porta visíveis ou caminhos complicados.
                                            </p>
                                        </div>

                                        <div className="pl-4 border-l-2 border-blue-500/30 dark:border-blue-400/30">
                                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Navegação Visual</h4>
                                            <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-0.5">Barra de endereços mais limpa</p>
                                            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm leading-relaxed">
                                                Ao navegar pelo sistema, o endereço no navegador permanece fixo, proporcionando uma experiência de uso mais focada e profissional.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <hr className="border-gray-100 dark:border-neutral-700" />

                        {/* Configurações de Email */}
                        <section>
                            <div className="flex items-start gap-5">
                                <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0">
                                    <Mail size={28} />
                                </div>
                                <div className="space-y-6 w-full">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Interface de Email</h3>
                                        <p className="text-gray-600 dark:text-gray-300 mt-1">
                                            Pequenos detalhes que fazem a diferença na usabilidade.
                                        </p>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="pl-4 border-l-2 border-indigo-500/30 dark:border-indigo-400/30">
                                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">Visualização de Senha Inteligente</h4>
                                            <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-0.5">Interface mais limpa</p>
                                            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm leading-relaxed">
                                                O ícone de "visualizar senha" agora só aparece quando você está digitando uma nova senha, mantendo a tela mais organizada quando não é necessário.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-neutral-900/50 p-6 border-t border-gray-100 dark:border-neutral-700 flex justify-between items-center transition-colors">
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Obrigado por utilizar o TestFlow.</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 text-white dark:bg-neutral-700 dark:hover:bg-neutral-600 font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotes;
