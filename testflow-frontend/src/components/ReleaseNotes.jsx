import { X, Sparkles, Zap, ShieldCheck } from 'lucide-react';

const ReleaseNotes = ({ isOpen, onClose, version }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-gray-100">

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
                                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shrink-0">
                                    <ShieldCheck size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Segurança e Identidade</h3>
                                    <p className="text-gray-600 mt-1 leading-relaxed">
                                        Reforçamos a identificação e segurança dos usuários.
                                    </p>
                                    <ul className="mt-3 space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <strong>Novo Campo "Nome":</strong> Agora os usuários possuem identificação real (Nome + Sobrenome) além do usuário técnico.
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <strong>Emails Inteligentes:</strong> O sistema detecta automaticamente a configuração de segurança (SSL/TLS) ideal para seu servidor de email.
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <strong>Recuperação de Senha:</strong> Emails de redefinição agora são personalizados com o nome do usuário para maior confiança.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <hr className="border-gray-100" />

                        {/* Visual */}
                        <section>
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-purple-100 text-purple-600 rounded-xl shrink-0">
                                    <Sparkles size={28} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Melhorias de Visual e Usabilidade</h3>
                                    <p className="text-gray-600 mt-1 leading-relaxed">
                                        Pequenos ajustes que fazem toda a diferença no dia a dia.
                                    </p>
                                    <ul className="mt-3 space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            Menu de usuário aprimorado e alinhado na barra superior.
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            Validação mais clara e direta na tela "Esqueci minha senha".
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-gray-700">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                            Correção na criação de usuários para evitar travamentos.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                    </div>
                </div>

                <div className="bg-gray-50 p-6 border-t border-gray-100 flex justify-between items-center">
                    <p className="text-sm text-gray-500 font-medium">Obrigado por utilizar o TestFlow.</p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotes;
