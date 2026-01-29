import { X, Rocket, Shield, Layers, FileText, CheckSquare, Image, Settings, Server, Wrench } from 'lucide-react';

const ReleaseNotes = ({ isOpen, onClose, version }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm p-4 transition-all duration-300">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100 dark:border-neutral-700">

                {/* Header */}
                <div className="relative shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 p-6 md:p-8 text-white">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>

                    <div className="flex flex-col items-center text-center space-y-2">
                        <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/20 mb-2">
                            <Rocket size={32} className="text-emerald-100" />
                        </div>
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight">TestFlow {version}</h2>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/30 text-emerald-50 border border-emerald-400/30">
                            Production Ready
                        </span>
                        <p className="text-emerald-50 text-sm md:text-base max-w-lg mt-2 font-medium">
                            29/01/2026
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="space-y-8">

                        <div className="text-center space-y-2">
                            <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                                🎉 <strong>Temos o orgulho de apresentar a primeira versão oficial do TestFlow!</strong>
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Uma plataforma completa, robusta e containerizada para gestão de qualidade de software.
                            </p>
                        </div>

                        <div className="border-t border-gray-100 dark:border-neutral-700 pt-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Rocket className="text-emerald-500" size={20} />
                                Funcionalidades Principais
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Auth */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <Shield size={16} className="text-blue-500" /> Segurança
                                    </h4>
                                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-4 text-justify">
                                        <li><strong>Login Seguro (JWT):</strong> Proteção completa de rotas.</li>
                                        <li><strong>RBAC:</strong> Perfis de Admin (Gestão Total) e QA (Execução).</li>
                                        <li><strong>Recuperação de Senha:</strong> Fluxo seguro com token via e-mail.</li>
                                    </ul>
                                </div>

                                {/* Projects */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <Layers size={16} className="text-purple-500" /> Projetos
                                    </h4>
                                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-4 text-justify">
                                        <li><strong>CRUD Completo:</strong> Gestão total de projetos.</li>
                                        <li><strong>Deep Clone:</strong> Duplicação inteligente de estruturas para testes de regressão.</li>
                                    </ul>
                                </div>

                                {/* Demands */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <FileText size={16} className="text-orange-500" /> Demandas
                                    </h4>
                                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-4 text-justify">
                                        <li><strong>Fluxo Ágil:</strong> Pendente &rarr; Em Andamento &rarr; Testado.</li>
                                        <li><strong>Tags & Links:</strong> Organização visual e integração com Jira/Trello.</li>
                                    </ul>
                                </div>

                                {/* Evidences */}
                                <div className="space-y-3">
                                    <h4 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-sm uppercase tracking-wide">
                                        <Image size={16} className="text-pink-500" /> Evidências
                                    </h4>
                                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc pl-4 text-justify">
                                        <li><strong>Galeria:</strong> Upload múltiplo e visualização integrada.</li>
                                        <li><strong>Centralização:</strong> Adeus pastas soltas na rede.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-neutral-700 pt-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Wrench className="text-gray-500" size={20} />
                                Infraestrutura & Changelog
                            </h3>

                            <div className="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-sm text-gray-600 dark:text-gray-400 space-y-4">
                                <div>
                                    <strong className="text-gray-900 dark:text-white block mb-1">Frontend</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>[NEW] DocumentationModal e AboutModal responsivos e detalhados.</li>
                                        <li>[FIX] Correção do fluxo de ResetPassword e limpeza de URLs.</li>
                                        <li>[UPDATE] Refinamento visual com TailwindCSS.</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong className="text-gray-900 dark:text-white block mb-1">Backend & Infra</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>[NEW] Serviço de Email dinâmico com suporte a Gmail/Outlook.</li>
                                        <li>[FIX] Configuração Nginx otimizada para SPA e Deep Linking.</li>
                                        <li>[NEW] Proteção de rotas sensíveis e sanitização de dados.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 bg-gray-50 dark:bg-neutral-900/50 p-4 md:p-6 border-t border-gray-100 dark:border-neutral-700 flex justify-center text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                        "Qualidade não é um ato, é um hábito."
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotes;
