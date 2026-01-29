import { X, CheckCircle, Target, Zap } from 'lucide-react';

const AboutModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm p-4 transition-all duration-300">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-neutral-700">

                {/* Header */}
                <div className="relative shrink-0 bg-gradient-to-br from-blue-900 to-indigo-900 p-6 md:p-8 text-white">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20">
                            <Target size={40} className="text-blue-300" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">O que é o TestFlow?</h2>
                        <p className="text-blue-200 text-base md:text-lg max-w-lg leading-relaxed">
                            A solução definitiva para centralizar, organizar e escalar a qualidade dos seus projetos de software.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="prose dark:prose-invert max-w-none">

                        <div className="mb-8 md:mb-10">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 text-center md:text-left">Transforme Caos em Controle</h3>
                            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-base text-justify">
                                O desenvolvimento de software moderno exige velocidade, mas a velocidade sem controle resulta em bugs e retrabalho.
                                O <strong>TestFlow</strong> não é apenas uma ferramenta de registro; é o centro de comando da sua equipe de QA.
                                Ele elimina planilhas descentralizadas, comunicações perdidas e evidências espalhadas, trazendo tudo para um fluxo único e coeso.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <Zap className="text-blue-600 dark:text-blue-400" size={24} />
                                    <h4 className="font-bold text-gray-900 dark:text-white">Agilidade Real</h4>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 text-justify">
                                    Crie demandas, associe cenários e gere evidências em segundos. O fluxo foi desenhado para reduzir cliques e maximizar produtividade.
                                </p>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <CheckCircle className="text-indigo-600 dark:text-indigo-400" size={24} />
                                    <h4 className="font-bold text-gray-900 dark:text-white">Confiabilidade</h4>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 text-justify">
                                    Garanta que cada entrega foi testada. Com a rastreabilidade total, você sabe exatamente o que foi validado, por quem e quando.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center md:text-left">Por que escolher o TestFlow?</h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-3">
                                    <span className="mt-1 p-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex-shrink-0">
                                        <CheckCircle size={16} />
                                    </span>
                                    <div>
                                        <strong className="text-gray-900 dark:text-white block">Organização Hierárquica</strong>
                                        <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block">Projetos &gt; Demandas &gt; Cenários. Uma estrutura lógica que faz sentido para engenheiros e gerentes.</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="mt-1 p-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex-shrink-0">
                                        <CheckCircle size={16} />
                                    </span>
                                    <div>
                                        <strong className="text-gray-900 dark:text-white block">Evidências Visuais e Robustas</strong>
                                        <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block">Upload de prints e documentos diretamente na demanda. Se não está no TestFlow, não foi testado.</span>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="mt-1 p-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex-shrink-0">
                                        <CheckCircle size={16} />
                                    </span>
                                    <div>
                                        <strong className="text-gray-900 dark:text-white block">Feito para Escalar</strong>
                                        <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block">De pequenas startups a grandes corporações, o TestFlow se adapta ao volume do seu time sem perder performance.</span>
                                    </div>
                                </li>
                            </ul>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 bg-gray-50 dark:bg-neutral-900/50 p-4 md:p-6 border-t border-gray-100 dark:border-neutral-700 flex justify-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                        "Qualidade não é um ato, é um hábito. Facilite esse hábito com TestFlow."
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AboutModal;
