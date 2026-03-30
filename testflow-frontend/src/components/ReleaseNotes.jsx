import { X, Rocket, Shield, Wrench } from 'lucide-react';

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
                            30/03/2026
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                    <div className="space-y-8">

                        <div className="text-center space-y-2">
                            <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
                                🔒 <strong>Correções de segurança e melhorias de usabilidade.</strong>
                            </p>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Remediação completa das 7 vulnerabilidades identificadas no pentest.
                            </p>
                        </div>

                        <div className="border-t border-gray-100 dark:border-neutral-700 pt-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Shield className="text-red-500" size={20} />
                                Correções de Segurança (Pentest)
                            </h3>

                            <div className="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-sm text-gray-600 dark:text-gray-400 space-y-4">
                                <ul className="list-disc pl-4 space-y-2">
                                    <li><strong>[FIX] CWE-434:</strong> Upload restrito a 14 extensões permitidas (.csv, .xlsx, .docx, .doc, .pdf, .txt, .log, .png, .jpg, .jpeg, .mp4, .mkv, .mp3, .wav) com validação de MIME type e bloqueio de dupla extensão.</li>
                                    <li><strong>[FIX] CWE-601:</strong> Validação de URLs via Allowlist configurável. Links de demandas só são aceitos se pertencerem às plataformas autorizadas.</li>
                                    <li><strong>[FIX] CWE-326:</strong> Cifras TLS fracas removidas. Apenas TLSv1.2/1.3 com Forward Secrecy (ECDHE).</li>
                                    <li><strong>[FIX] CWE-693:</strong> Content Security Policy (CSP) implementada no NGINX.</li>
                                    <li><strong>[FIX] CWE-1021:</strong> Proteção anti-Clickjacking com X-Frame-Options e frame-ancestors.</li>
                                    <li><strong>[FIX] CWE-200:</strong> Versão do NGINX ocultada em cabeçalhos e páginas de erro (3 instâncias).</li>
                                    <li><strong>[FIX] CWE-272:</strong> RBAC reforçado — apenas Administradores podem gerenciar usuários.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-neutral-700 pt-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Rocket className="text-emerald-500" size={20} />
                                Melhorias
                            </h3>

                            <div className="bg-gray-50 dark:bg-neutral-900 p-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-sm text-gray-600 dark:text-gray-400 space-y-4">
                                <div>
                                    <strong className="text-gray-900 dark:text-white block mb-1">Frontend</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>[NEW] Tela administrativa de URLs Permitidas (Allowlist) nas Configurações.</li>
                                        <li>[NEW] Seletor dinâmico de Plataforma + Ticket no formulário de demandas.</li>
                                        <li>[NEW] Tooltip informativo com lista de formatos permitidos no modal de Evidências.</li>
                                        <li>[NEW] Notificação de "Extensão não suportada" ao tentar enviar arquivos não permitidos.</li>
                                        <li>[UPDATE] Filtro de seleção de arquivos atualizado para pré-filtrar extensões válidas.</li>
                                        <li>[FIX] Ocultação de botões administrativos para perfis não-admin na tela de Usuários.</li>
                                    </ul>
                                </div>
                                <div>
                                    <strong className="text-gray-900 dark:text-white block mb-1">Backend &amp; Infra</strong>
                                    <ul className="list-disc pl-4 space-y-1">
                                        <li>[NEW] Cabeçalhos de segurança HSTS, CSP e X-Frame-Options no NGINX.</li>
                                        <li>[NEW] Pastas de evidências com nomenclatura legível (ID_Nome) ao invés de hash.</li>
                                        <li>[UPDATE] Cifras TLS refinadas com exclusão explícita de suítes fracas.</li>
                                        <li>[UPDATE] Middleware RBAC restrito a admin para rotas de gestão de usuários.</li>
                                        <li>[UPDATE] server_tokens off aplicado em todas as instâncias NGINX.</li>
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
