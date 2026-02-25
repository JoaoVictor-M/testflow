import { useState } from 'react';
import { X, BookOpen, Layers, FileText, CheckSquare, Users, Settings, Hash, Activity } from 'lucide-react';

// Conteúdo da documentação mapeado por chaves
const DOC_CONTENT = {
    intro: {
        title: "Introdução",
        icon: <BookOpen size={24} />,
        content: (
            <div className="space-y-4">
                <p className="text-lg text-gray-700 dark:text-gray-300 text-justify leading-relaxed">
                    O <strong>TestFlow</strong> é uma plataforma intuitiva projetada para centralizar e otimizar o gerenciamento de ciclos de teste de software.
                    Nesta documentação, você encontrará todos os detalhes operacionais para extrair o máximo da ferramenta, desde a criação de projetos até a configuração avançada de sistema.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border-l-4 border-blue-500">
                        <h4 className="font-bold text-gray-800 dark:text-white">Fluxo de Trabalho</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 text-justify">
                            <strong>1. Projeto:</strong> O escopo macro (Produto/Sistema).<br />
                            <strong>2. Demanda:</strong> A funcionalidade ou correção específica.<br />
                            <strong>3. Cenário:</strong> O passo a passo técnico de validação.<br />
                            <strong>4. Evidência:</strong> A prova cabal do teste realizado.
                        </p>
                    </div>
                </div>
            </div>
        )
    },
    projects: {
        title: "Projetos",
        icon: <Layers size={24} />,
        content: (
            <div className="space-y-8">
                <p className="text-gray-600 dark:text-gray-300 text-justify">
                    Os <strong>Projetos</strong> são a raiz da estrutura do TestFlow. Eles organizam todo o trabalho de QA por produto, squad ou sistema.
                    Nesta tela, você tem uma visão geral de todos os sistemas sob teste.
                </p>

                <div className="space-y-6">
                    <section>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <Layers size={20} className="text-blue-500" />
                            Funcionalidades Principais
                        </h4>
                        <ul className="space-y-4 pl-4 border-l-2 border-gray-100 dark:border-neutral-800">
                            <li>
                                <strong className="text-gray-800 dark:text-white block">Criar Projeto</strong>
                                <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block mt-1">
                                    Utilize o botão "Novo Projeto". É obrigatório definir um <strong>Nome</strong> único e recomendado adicionar uma <strong>Descrição</strong> detalhada sobre o escopo do projeto (ex: tecnologias, stakeholders).
                                </span>
                            </li>
                            <li>
                                <strong className="text-gray-800 dark:text-white block">Editar Projeto</strong>
                                <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block mt-1">
                                    Ao clicar no ícone de lápis, você pode alterar o nome ou descrição. O ID interno do projeto permanece imutável para garantir a integridade dos dados.
                                </span>
                            </li>
                            <li>
                                <strong className="text-gray-800 dark:text-white block">Excluir Projeto</strong>
                                <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block mt-1">
                                    <span className="text-red-500 font-bold">Atenção:</span> A exclusão é irreversível e cascata. Ao apagar um projeto, <strong>TODAS</strong> as demandas, cenários e evidências associadas serão permanentemente removidas do banco de dados e do sistema de arquivos.
                                </span>
                            </li>
                        </ul>
                    </section>

                    <section className="bg-gray-50 dark:bg-neutral-800/50 p-5 rounded-xl border border-gray-100 dark:border-neutral-700">
                        <h4 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                            Duplicação Inteligente (Deep Clone)
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-justify leading-relaxed">
                            O botão <strong>Duplicar</strong> aciona uma cópia profunda. Isso é extremamente útil para <strong>Testes de Regressão</strong> de uma nova versão (ex: v1.0 para v1.1).
                            <br /><br />
                            O sistema cria uma cópia exata do Projeto, clonando todas as suas <strong>Demandas</strong> e todos os <strong>Cenários</strong> vinculados. As evidências (arquivos) não são copiadas, pois se entende que a nova versão exigirá novas provas.
                        </p>
                    </section>
                </div>
            </div>
        )
    },
    demands: {
        title: "Demandas",
        icon: <FileText size={24} />,
        content: (
            <div className="space-y-8">
                <p className="text-gray-600 dark:text-gray-300 text-justify">
                    As <strong>Demandas</strong> são as unidades de trabalho. Geralmente correspondem a um card no Jira, Trello, Azure DevOps ou uma User Story específica.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h5 className="font-bold text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-neutral-800">Campos Essenciais</h5>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-3">
                            <li>
                                <strong className="text-blue-600 dark:text-blue-400">Status:</strong> Define o ciclo de vida.
                                <span className="block text-xs mt-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded">Pendente &rarr; Em Andamento &rarr; Testado</span>
                            </li>
                            <li>
                                <strong className="text-purple-600 dark:text-purple-400">Tags:</strong>
                                Etiquetas visuais para agrupar demandas (ex: <code>Critico</code>, <code>Sprint-25</code>, <code>Front-End</code>).
                            </li>
                            <li>
                                <strong className="text-green-600 dark:text-green-400">Responsáveis:</strong>
                                Múltiplos QAs podem ser atribuídos a uma única demanda.
                            </li>
                        </ul>
                    </div>

                    <div className="space-y-3">
                        <h5 className="font-bold text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-neutral-800">Integração</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400 text-justify">
                            O campo <strong>Link Externo</strong> é vital para rastreabilidade. Insira a URL direta do card na sua ferramenta de gestão de projetos (Jira, Monday, etc).
                            Isso cria um link clicável direto na lista de demandas, facilitando a navegação entre sistemas.
                        </p>
                    </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700/50">
                    <h5 className="font-bold text-yellow-800 dark:text-yellow-400 mb-1">Regra de Ouro do QA</h5>
                    <p className="text-sm text-yellow-800/80 dark:text-yellow-500/80 text-justify">
                        Uma demanda <strong>NUNCA</strong> deve ser movida para o status <strong>"Testado"</strong> sem que existam evidências (prints ou vídeos) anexadas. O sistema emite alertas, mas a disciplina do time é fundamental.
                    </p>
                </div>
            </div>
        )
    },
    scenarios: {
        title: "Cenários",
        icon: <CheckSquare size={24} />,
        content: (
            <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-300 text-justify">
                    Se a Demanda é o "O Quê", o <strong>Cenário</strong> é o "Como". Aqui descrevemos tecnicamente os passos para validar a funcionalidade.
                </p>

                <div className="bg-gray-50 dark:bg-neutral-800 p-6 rounded-xl border border-gray-100 dark:border-neutral-700">
                    <h5 className="font-bold text-gray-800 dark:text-white mb-4">Estrutura de um Bom Cenário</h5>
                    <div className="space-y-4 text-sm">
                        <div>
                            <span className="uppercase text-xs font-bold text-gray-400 tracking-wider">Título</span>
                            <p className="font-medium text-gray-700 dark:text-gray-300">Resumo claro do objetivo (ex: "Validar Login com Senha Incorreta")</p>
                        </div>
                        <div>
                            <span className="uppercase text-xs font-bold text-gray-400 tracking-wider">Descrição / Passos</span>
                            <div className="mt-1 font-mono text-xs bg-white dark:bg-neutral-900 p-3 rounded border border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-gray-400">
                                1. Dado que estou na tela de login<br />
                                2. Quando insiro o email "teste@exemplo.com"<br />
                                3. E insiro a senha "senhaerrada123"<br />
                                4. E clico no botão "Entrar"<br />
                                5. Então devo ver a mensagem "Credenciais Inválidas"
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    evidences: {
        title: "Evidências",
        icon: <Hash size={24} />,
        content: (
            <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-300 text-justify">
                    A gestão de <strong>Evidências</strong> é o diferencial do TestFlow. Ela centraliza arquivos que comprovam a execução dos testes, eliminando pastas compartilhadas na rede ou anexos perdidos em emails.
                </p>

                <ul className="space-y-3 bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-800/30">
                    <li className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <CheckSquare className="text-blue-500 shrink-0" size={18} />
                        <span><strong>Upload Múltiplo:</strong> Arraste e solte várias imagens de uma vez.</span>
                    </li>
                    <li className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <CheckSquare className="text-blue-500 shrink-0" size={18} />
                        <span><strong>Pré-visualização:</strong> Visualize as imagens diretamente no modal sem precisar baixar.</span>
                    </li>
                    <li className="flex gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <CheckSquare className="text-blue-500 shrink-0" size={18} />
                        <span><strong>Organização Automática:</strong> O sistema cria pastas no servidor organizadas por ID da Demanda, garantindo que nada se misture.</span>
                    </li>
                </ul>
            </div>
        )
    },
    users: {
        title: "Usuários & Permissões",
        icon: <Users size={24} />,
        content: (
            <div className="space-y-8">
                <p className="text-gray-600 dark:text-gray-300 text-justify">
                    A segurança e organização do TestFlow dependem de uma correta atribuição de perfis. Existem dois níveis principais de acesso.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                        <div className="bg-gray-100 dark:bg-neutral-800 p-3 border-b border-gray-200 dark:border-neutral-700 font-bold text-center text-gray-800 dark:text-white">
                            ADMINISTRADOR (Admin)
                        </div>
                        <div className="p-4 bg-white dark:bg-neutral-900 h-full">
                            <p className="text-xs text-gray-500 pb-3 text-center uppercase tracking-wide">O usuário técnico</p>
                            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Acesso total ao sistema</li>
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Criar/Editar/Excluir Usuários</li>
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Configurar Servidor de Email</li>
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Resetar senhas de terceiros</li>
                            </ul>
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs rounded text-justify">
                                <strong>Segurança:</strong> A senha do Admin nunca deve ser compartilhada. Ele é o guardião das configurações globais.
                            </div>
                        </div>
                    </div>

                    <div className="border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden">
                        <div className="bg-gray-100 dark:bg-neutral-800 p-3 border-b border-gray-200 dark:border-neutral-700 font-bold text-center text-gray-800 dark:text-white">
                            QA / USUÁRIO
                        </div>
                        <div className="p-4 bg-white dark:bg-neutral-900 h-full">
                            <p className="text-xs text-gray-500 pb-3 text-center uppercase tracking-wide">O usuário operacional</p>
                            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Criar Projetos e Demandas</li>
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Executar Testes e Anexar Evidências</li>
                                <li className="flex items-center gap-2"><CheckSquare size={14} className="text-green-500" /> Editar seu próprio perfil</li>
                                <li className="flex items-center gap-2"><X size={14} className="text-red-500" /> Sem acesso a Configurações Globais</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    settings: {
        title: "Configurações de Sistema",
        icon: <Settings size={24} />,
        content: (
            <div className="space-y-8">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg flex items-start gap-3">
                    <Settings className="text-indigo-600 mt-1 shrink-0" />
                    <div>
                        <h4 className="font-bold text-indigo-900 dark:text-indigo-300">Área Restrita</h4>
                        <p className="text-sm text-indigo-800 dark:text-indigo-400 text-justify">
                            As configurações abaixo afetam todo o funcionamento da instância do TestFlow e são restritas exclusivamente a usuários com perfil <strong>ADMIN</strong>.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">
                        Configuração de E-mail (SMTP)
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-justify">
                        O TestFlow utiliza um servidor SMTP para enviar convites de novos usuários e emails de recuperação de senha. Sem essa configuração, essas funcionalidades ficarão inativas.
                    </p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
                        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
                            <h5 className="font-bold text-gray-800 dark:text-white mb-3 text-sm uppercase">Campos Obrigatórios</h5>
                            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                                <li>
                                    <strong>Host:</strong> Endereço do servidor (ex: smtp.gmail.com).
                                </li>
                                <li>
                                    <strong>Porta:</strong> Geralmente 587 (TLS) ou 465 (SSL).
                                </li>
                                <li>
                                    <strong>Usuário/Email:</strong> O email que enviará as mensagens.
                                </li>
                                <li>
                                    <strong>Senha (App Password):</strong> A senha de aplicativo gerada pelo provedor (não use sua senha pessoal!).
                                </li>
                                <li>
                                    <strong>Remetente (From):</strong> Nome que aparecerá no email (ex: "TestFlow System").
                                </li>
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-5">
                            <h5 className="font-bold text-gray-800 dark:text-white mb-3 text-sm uppercase">Exemplos Comuns</h5>

                            <div className="mb-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    <strong className="text-sm text-gray-800 dark:text-white">Google (Gmail)</strong>
                                </div>
                                <code className="block bg-gray-100 dark:bg-neutral-900 p-2 rounded text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    Host: smtp.gmail.com<br />
                                    Port: 587<br />
                                    Secure: false (STARTTLS)<br />
                                    Senha: Use "App Password"
                                </code>
                            </div>

                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                    <strong className="text-sm text-gray-800 dark:text-white">Microsoft (Outlook/Office365)</strong>
                                </div>
                                <code className="block bg-gray-100 dark:bg-neutral-900 p-2 rounded text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    Host: smtp.office365.com<br />
                                    Port: 587<br />
                                    Secure: false<br />
                                </code>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    },
    audit: {
        title: "Auditoria",
        icon: <Activity size={24} />,
        content: (
            <div className="space-y-6">
                <p className="text-gray-600 dark:text-gray-300 text-justify">
                    A tela de <strong>Auditoria</strong> é um painel exclusivo para usuários com perfil Administrador, criado para oferecer total transparência e rastreabilidade sobre as ações realizadas no sistema.
                </p>

                <div className="bg-gray-50 dark:bg-neutral-800 p-6 rounded-xl border border-gray-100 dark:border-neutral-700">
                    <h5 className="font-bold text-gray-800 dark:text-white mb-4">Recursos Disponíveis</h5>
                    <ul className="space-y-3 pl-4 border-l-2 border-gray-100 dark:border-neutral-800">
                        <li>
                            <strong className="text-gray-800 dark:text-white block">Monitoramento Contínuo</strong>
                            <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block mt-1">
                                O sistema intercepta silenciosamente qualquer operação de <i>Criação</i>, <i>Edição</i>, <i>Exclusão</i> ou <i>Duplicação</i> (Clone) de recursos chaves do sistema.
                            </span>
                        </li>
                        <li>
                            <strong className="text-gray-800 dark:text-white block">Visualização de Diferenças (Diff)</strong>
                            <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block mt-1">
                                Ao investigar uma alteração, você pode clicar em <strong>"Ver Detalhes"</strong> para saber exatamente quais campos textuais ou configurações anteriores foram mudados e para o que foram mudados em formato amigável.
                            </span>
                        </li>
                        <li>
                            <strong className="text-gray-800 dark:text-white block">Filtros Avançados</strong>
                            <span className="text-gray-600 dark:text-gray-400 text-sm text-justify block mt-1">
                                Para cenários com milhares de registros, utilize os botões superiores para filtrar os logs por uma janela específica de Data e Hora, por um Usuário específico, Menu ou Ação que você está procurando.
                            </span>
                        </li>
                    </ul>
                </div>
            </div>
        )
    }
};

const DocumentationModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('intro');

    if (!isOpen) return null;

    // Helper para item do menu
    const MenuItem = ({ id, label, icon }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-lg 
            ${activeTab === id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 dark:bg-black/80 backdrop-blur-sm p-4 transition-all duration-300">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col md:flex-row border border-gray-100 dark:border-neutral-700 animate-in fade-in zoom-in duration-200">

                {/* Sidebar */}
                <div className="w-full md:w-1/4 bg-gray-50 dark:bg-neutral-950 border-b md:border-b-0 md:border-r border-gray-200 dark:border-neutral-800 p-4 overflow-y-auto md:overflow-y-auto max-h-[200px] md:max-h-full">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-2">Menu</h3>
                    <div className="space-y-1 grid grid-cols-2 md:block gap-2 md:gap-0">
                        <MenuItem id="intro" label="Introdução" icon={<BookOpen size={18} />} />
                        <MenuItem id="projects" label="Projetos" icon={<Layers size={18} />} />
                        <MenuItem id="demands" label="Demandas" icon={<FileText size={18} />} />
                        <MenuItem id="scenarios" label="Cenários" icon={<CheckSquare size={18} />} />
                        <MenuItem id="evidences" label="Evidências" icon={<Hash size={18} />} />
                        <MenuItem id="users" label="Usuários" icon={<Users size={18} />} />
                        <MenuItem id="audit" label="Auditoria" icon={<Activity size={18} />} />
                        <MenuItem id="settings" label="Configurações" icon={<Settings size={18} />} />
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900">
                    {/* Header do Content */}
                    <div className="h-16 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between px-8 bg-white dark:bg-neutral-900">
                        <div className="flex items-center gap-3 text-gray-800 dark:text-white">
                            <span className="text-blue-600 dark:text-blue-500">{DOC_CONTENT[activeTab].icon}</span>
                            <h2 className="text-xl font-bold">{DOC_CONTENT[activeTab].title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <div className="max-w-3xl">
                            {DOC_CONTENT[activeTab].content}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default DocumentationModal;
