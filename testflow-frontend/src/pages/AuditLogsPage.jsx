import React, { useState, useEffect, Fragment } from 'react';
import { Popover, Transition } from '@headlessui/react';
import api from '../api';
import toast from 'react-hot-toast';

// --- ÍCONES ---
const FilterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
);
const SortIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
    </svg>
);
// --- FIM DOS ÍCONES ---

function AuditLogsPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filtros
    const [actionFilter, setActionFilter] = useState('Todos');
    const [menuFilter, setMenuFilter] = useState('Todos');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');
    const [userFilter, setUserFilter] = useState('');
    const [usersList, setUsersList] = useState([]);

    // Ordenação
    const [sortBy, setSortBy] = useState('date'); // 'date', 'action', 'menu', 'user'
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc', 'desc'

    // Detalhes Modal
    const [selectedDetails, setSelectedDetails] = useState(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 15 };
            if (actionFilter !== 'Todos') params.action = actionFilter;
            if (menuFilter !== 'Todos') params.menu = menuFilter;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;
            if (startTime) params.startTime = startTime;
            if (endTime) params.endTime = endTime;
            if (userFilter) params.user = userFilter;

            params.sortBy = sortBy;
            params.order = sortOrder;

            const response = await api.get('/audit', { params });
            setLogs(response.data.data);
            setTotalPages(response.data.pages);
        } catch (error) {
            toast.error('Erro ao carregar logs: ' + (error.response?.data?.message || error.message));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [page, sortBy, sortOrder]); // Refresh fetches automatically on page or sort change

    useEffect(() => {
        const fetchUsersList = async () => {
            try {
                const response = await api.get('/users');
                setUsersList(response.data);
            } catch (err) {
                console.error("Erro ao buscar usuários para filtro:", err);
            }
        };
        fetchUsersList();
    }, []);

    const applyFilters = () => {
        setPage(1);
        fetchLogs();
    };

    const toggleSortOrder = () => {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString('pt-BR');
    };

    const getActionBadge = (action) => {
        switch (action) {
            case 'CREATE': return <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 flex-shrink-0 py-1 text-xs font-semibold rounded-full">CREATE</span>;
            case 'UPDATE': return <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 flex-shrink-0 py-1 text-xs font-semibold rounded-full">UPDATE</span>;
            case 'DELETE': return <span className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 px-2 flex-shrink-0 py-1 text-xs font-semibold rounded-full">DELETE</span>;
            default: return <span>{action}</span>;
        }
    };

    const getEntityName = (entity) => {
        const map = {
            'Project': 'Projetos',
            'Demanda': 'Demandas',
            'Scenario': 'Cenários',
            'User': 'Usuários',
            'SystemConfig': 'Configurações de Email'
        };
        return map[entity] || entity;
    };

    const getFieldName = (key) => {
        const fieldTranslations = {
            name: 'Nome',
            nome: 'Nome',
            username: 'Usuário de Login',
            email: 'E-mail',
            role: 'Perfil de Acesso',
            title: 'Título',
            description: 'Descrição',
            status: 'Status',
            projectId: 'Projeto',
            project: 'Projeto',
            demandaId: 'ID da Demanda',
            demanda: 'Demanda',
            scenarioId: 'Cenário',
            priority: 'Prioridade',
            expectedResult: 'Resultado Esperado',
            preConditions: 'Pré-condições',
            testType: 'Tipo de Teste',
            testScope: 'Escopo de Teste',
            color: 'Cor',
            host: 'Host',
            port: 'Porta',
            user: 'Remetente/E-mail',
            pass: 'Senha',
            secure: 'Segurança SSL/TLS',
            from: 'Remetente de Envio',
            linkDemanda: 'Link da Demanda',
            tempoEstimado: 'Tempo Estimado (h)',
            steps: 'Passos da Execução',
            mantisLink: 'Link do Mantis',
            tags: 'Tags',
            versions: 'Versões',
            servers: 'Servidores',
            responsaveis: 'Responsáveis',
            evidences: 'Evidências',
            password: 'Senha'
        };
        return fieldTranslations[key] || key;
    };

    const formatValue = (key, val) => {
        if (val === null || val === undefined) return 'vazio';
        if (key === 'role') {
            const roles = { admin: 'Administrador', qa: 'QA/Analista', viewer: 'Visualizador' };
            return roles[val] || val;
        }
        if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
        if (Array.isArray(val)) return `[Lista com ${val.length} itens]`;
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const renderDifferences = (oldData, newData) => {
        const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
        const diffs = [];

        keys.forEach(key => {
            if (key === '_id' || key === '__v' || key === 'createdAt' || key === 'updatedAt' || key === 'password' || key === 'resetPasswordToken') return;

            const oldValRaw = oldData && oldData[key] !== undefined ? oldData[key] : undefined;
            const newValRaw = newData && newData[key] !== undefined ? newData[key] : undefined;

            // Compara os strings JSON para lidar com objetos/arrays
            if (JSON.stringify(oldValRaw) !== JSON.stringify(newValRaw)) {
                diffs.push({
                    key,
                    oldVal: formatValue(key, oldValRaw),
                    newVal: formatValue(key, newValRaw)
                });
            }
        });

        if (diffs.length === 0) return <p className="text-sm text-gray-500">Nenhuma alteração registrada em campos monitorados.</p>;

        return (
            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                {diffs.map(d => (
                    <li key={d.key}>
                        Alterado <strong>{getFieldName(d.key)}</strong> de <code className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1 rounded">{d.oldVal}</code> para <code className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-1 rounded font-semibold">{d.newVal}</code>.
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Auditoria</h1>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
                <Popover className="relative w-full md:w-auto">
                    {({ open, close }) => (
                        <>
                            <Popover.Button className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-colors ${open ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700'}`}>
                                <FilterIcon /> Filtros
                            </Popover.Button>
                            <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                                <Popover.Panel className="absolute z-10 left-0 mt-2 w-80 p-4 bg-white dark:bg-neutral-800 shadow-xl rounded-xl border border-gray-200 dark:border-neutral-700">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="flex gap-2">
                                            <div className="w-1/2">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Data Início</label>
                                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-600 focus:border-blue-600 block p-2 sm:text-sm dark:[color-scheme:dark] accent-blue-600" />
                                            </div>
                                            <div className="w-1/2">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Data Fim</label>
                                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-600 focus:border-blue-600 block p-2 sm:text-sm dark:[color-scheme:dark] accent-blue-600" />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <div className="w-1/2">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hora Início</label>
                                                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-600 focus:border-blue-600 block p-2 sm:text-sm dark:[color-scheme:dark] accent-blue-600" />
                                            </div>
                                            <div className="w-1/2">
                                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Hora Fim</label>
                                                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-600 focus:border-blue-600 block p-2 sm:text-sm dark:[color-scheme:dark] accent-blue-600" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
                                            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 sm:text-sm">
                                                <option value="">Todos</option>
                                                {usersList.map(u => (
                                                    <option key={u._id} value={u.name || u.username}>{u.name || u.username}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Menu</label>
                                            <select value={menuFilter} onChange={(e) => setMenuFilter(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 sm:text-sm">
                                                <option value="Todos">Todos</option>
                                                <option value="Project">Projetos</option>
                                                <option value="Demanda">Demandas</option>
                                                <option value="Scenario">Cenários</option>
                                                <option value="User">Usuários</option>
                                                <option value="SystemConfig">Configurações de Email</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ação</label>
                                            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-full bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-gray-900 dark:text-white rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 sm:text-sm">
                                                <option value="Todos">Todas</option>
                                                <option value="CREATE">CREATE</option>
                                                <option value="UPDATE">UPDATE</option>
                                                <option value="DELETE">DELETE</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => { applyFilters(); close(); }}
                                            className="mt-2 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                                        >
                                            Aplicar Filtros
                                        </button>
                                    </div>
                                </Popover.Panel>
                            </Transition>
                        </>
                    )}
                </Popover>

                <Popover className="relative w-full md:w-auto">
                    {({ open }) => (
                        <>
                            <Popover.Button className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-colors ${open ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700'}`}>
                                <SortIcon /> Ordenar por
                            </Popover.Button>
                            <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                                <Popover.Panel className="absolute z-10 left-0 md:left-auto mt-2 w-56 p-2 bg-white dark:bg-neutral-800 shadow-xl rounded-xl border border-gray-200 dark:border-neutral-700">
                                    <div className="flex flex-col space-y-1">
                                        <button onClick={() => { setSortBy('date'); setPage(1); }} className={`text-left px-3 py-2 rounded-md text-sm ${sortBy === 'date' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}>Data/Hora</button>
                                        <button onClick={() => { setSortBy('user'); setPage(1); }} className={`text-left px-3 py-2 rounded-md text-sm ${sortBy === 'user' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}>Usuário</button>
                                        <button onClick={() => { setSortBy('menu'); setPage(1); }} className={`text-left px-3 py-2 rounded-md text-sm ${sortBy === 'menu' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}>Menu</button>
                                        <button onClick={() => { setSortBy('action'); setPage(1); }} className={`text-left px-3 py-2 rounded-md text-sm ${sortBy === 'action' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-semibold' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700'}`}>Ação</button>

                                        <div className="border-t border-gray-200 dark:border-neutral-700 my-1"></div>

                                        <button onClick={toggleSortOrder} className="text-left px-3 py-2 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 flex justify-between items-center">
                                            <span>Direção: {sortOrder === 'desc' ? 'Decrescente' : 'Crescente'}</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transform transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                    </div>
                                </Popover.Panel>
                            </Transition>
                        </>
                    )}
                </Popover>
            </div>

            <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 shadow-sm rounded-xl overflow-hidden relative min-h-[400px]">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-white/50 dark:bg-neutral-900/50 flex justify-center items-center backdrop-blur-[1px]">
                        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-neutral-700 text-sm">
                        <thead className="bg-gray-50 dark:bg-neutral-800/80">
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Data/Hora</th>
                                <th scope="col" className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Usuário</th>
                                <th scope="col" className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Ação</th>
                                <th scope="col" className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Menu</th>
                                <th scope="col" className="px-6 py-4 text-left font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Ações</th>
                            </tr>
                        </thead>
                        <tbody className={`bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-neutral-800 transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                            {logs.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">Nenhum registro encontrado.</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log._id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300 font-medium">
                                            {formatDate(log.createdAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm uppercase">
                                                    {log.user?.name ? log.user.name.charAt(0) : '?'}
                                                </div>
                                                <div className="ml-3">
                                                    <p className="text-gray-900 dark:text-neutral-200 font-medium">{log.user?.name || 'Sistema'}</p>
                                                    <p className="text-gray-500 dark:text-gray-400 text-xs">@{log.user?.username || 'admin'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                            <span className="font-semibold">{getEntityName(log.entity)}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                                            <button
                                                onClick={() => setSelectedDetails(log)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                                            >
                                                Ver Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Details and Buttons */}
                {!loading && logs.length > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                            Página <span className="font-medium">{page}</span> de <span className="font-medium">{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-neutral-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-neutral-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedDetails && (
                <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* Background overlay */}
                        <div className="fixed inset-0 bg-gray-500/75 dark:bg-neutral-900/80 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setSelectedDetails(null)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        {/* Modal panel */}
                        <div className="relative inline-block align-bottom bg-white dark:bg-neutral-800 rounded-xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full border border-gray-200 dark:border-neutral-700">
                            <div className="bg-white dark:bg-neutral-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                <div className="sm:flex sm:items-start">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                        <h3 className="text-xl leading-6 font-bold text-gray-900 dark:text-white" id="modal-title">
                                            Detalhes da Ação
                                        </h3>
                                        <div className="mt-4 bg-gray-50 dark:bg-neutral-900 p-4 rounded-lg border border-gray-200 dark:border-neutral-700">
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>ID do Registro:</strong> {selectedDetails._id}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>Local da Alteração:</strong> {getEntityName(selectedDetails.entity)} (Ref: {selectedDetails.entity})</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-2"><strong>ID da Entidade:</strong> {selectedDetails.entityId}</p>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4"><strong>Data da Ação:</strong> {formatDate(selectedDetails.createdAt)}</p>

                                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2 text-sm uppercase tracking-wide">Registro da Ação:</h4>

                                            {selectedDetails.details?.summary && (
                                                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800 text-sm font-medium">
                                                    {selectedDetails.details.summary}
                                                </div>
                                            )}

                                            <div className="bg-white dark:bg-neutral-800 p-4 rounded border border-gray-200 dark:border-neutral-700 text-sm overflow-x-auto">
                                                {selectedDetails.details?.old && selectedDetails.details?.new ? (
                                                    renderDifferences(selectedDetails.details.old, selectedDetails.details.new)
                                                ) : selectedDetails.details?.new ? (
                                                    // CREATE state
                                                    <div>
                                                        <p className="text-sm text-green-700 dark:text-green-400 font-semibold mb-2">Registro Criado:</p>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                                            Um(a) <strong>{getEntityName(selectedDetails.entity)}</strong> chamado(a) <code className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-1 rounded">{selectedDetails.details.new.nome || selectedDetails.details.new.name || selectedDetails.details.new.title || selectedDetails.details.new.username || selectedDetails.entityId}</code> foi adicionado(a) ao sistema.
                                                        </p>
                                                    </div>
                                                ) : selectedDetails.details?.old && selectedDetails.action === 'DELETE' ? (
                                                    // DELETE state
                                                    <div>
                                                        <p className="text-sm text-red-700 dark:text-red-400 font-semibold mb-2">Registro Removido:</p>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                                            Um(a) <strong>{getEntityName(selectedDetails.entity)}</strong> chamado(a) <code className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 px-1 rounded">{selectedDetails.details.old.nome || selectedDetails.details.old.name || selectedDetails.details.old.title || selectedDetails.details.old.username || selectedDetails.entityId}</code> foi permanentemente removido(a) do sistema.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <pre className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-xs">
                                                        {JSON.stringify(selectedDetails.details, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 dark:bg-neutral-800/50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 dark:border-neutral-700">
                                <button
                                    type="button"
                                    className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                                    onClick={() => setSelectedDetails(null)}
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default AuditLogsPage;
