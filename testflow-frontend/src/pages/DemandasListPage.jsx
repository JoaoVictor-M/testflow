import { useState, useEffect, Fragment, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Dialog, Transition, Popover } from '@headlessui/react';
import DemandaForm from '../components/DemandaForm';
import ConfirmationModal from '../components/ConfirmationModal'; // 1. IMPORTA O MODAL

// --- ÍCONES ---
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);
const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);
const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899l4-4a4 4 0 000-5.656 4 4 0 00-5.656 0l-1.102 1.101" />
  </svg>
);
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
const GridIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);
const ListIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const SortIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
  </svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);
// --- FIM DOS ÍCONES ---

// Funções de Cor
const getDemandaStatusClasses = (status) => {
  switch (status) {
    case 'Testado':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Testando':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Aguardando Correção':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    default: // Pendente
      return 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300';
  }
};
const getDemandaCardBgClass = (status) => {
  switch (status) {
    case 'Testado':
      return 'bg-green-50 dark:bg-green-900/10';
    case 'Testando':
      return 'bg-blue-50 dark:bg-blue-900/10';
    case 'Aguardando Correção':
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    default: // Pendente
      return 'bg-white dark:bg-slate-800';
  }
};


function DemandasListPage() {
  const [demandas, setDemandas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [demandaToEdit, setDemandaToEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [responsavelFilter, setResponsavelFilter] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('demandasViewMode') || 'list');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('demandasSortOrder') || 'creation');

  // Estados para o modal de deleção
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [demandaToDelete, setDemandaToDelete] = useState(null);

  const { user } = useContext(AuthContext); // [NEW]

  const ITEMS_PER_PAGE = viewMode === 'grid' ? 9 : 10;
  const { projectId } = useParams();
  const navigate = useNavigate();

  // Funções do Modal (Formulário)
  const closeModal = () => {
    setIsModalOpen(false);
    setDemandaToEdit(null);
  };
  const openCreateModal = () => {
    setDemandaToEdit(null);
    setIsModalOpen(true);
  };
  const openEditModal = (demanda) => {
    setDemandaToEdit(demanda);
    setIsModalOpen(true);
  };

  // Funções do Modal de Deleção
  const openDeleteModal = (demanda) => {
    setDemandaToDelete(demanda);
    setIsDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    setDemandaToDelete(null);
    setIsDeleteModalOpen(false);
  };
  const handleConfirmDelete = async () => {
    if (!demandaToDelete) return;
    try {
      await api.delete(`/demandas/${demandaToDelete._id}`);
      setDemandas(prev => prev.filter(d => d._id !== demandaToDelete._id));
      toast.success('Demanda deletada com sucesso!');
    } catch (err) {
      toast.error('Erro ao deletar a demanda.');
      console.error(err);
    }
  };

  // Função para buscar dados
  const fetchDemandas = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(`/demandas?projectId=${projectId}`);
      setDemandas(response.data);
      setError(null);
    } catch (err) {
      setError('Não foi possível carregar as demandas.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDemandas();
  }, [projectId]);

  // Hooks de Efeito
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, responsavelFilter, viewMode, sortOrder]);

  useEffect(() => {
    localStorage.setItem('demandasViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('demandasSortOrder', sortOrder);
  }, [sortOrder]);

  // Função para alternar a ordenação
  const toggleSortOrder = () => {
    setSortOrder(current => (current === 'alpha' ? 'creation' : 'alpha'));
  };

  // Função de callback pós-salvar
  const handleSaveSuccess = (savedDemanda, mode) => {
    if (mode === 'create') {
      setDemandas(prev => [savedDemanda, ...prev]);
    } else if (mode === 'update') {
      setDemandas(prev =>
        prev.map(d => (d._id === savedDemanda._id ? savedDemanda : d))
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  // Preparando dados para os filtros
  const allResponsaveis = [...new Set(demandas.flatMap(d => (Array.isArray(d.responsaveis) ? d.responsaveis.map(r => r.name) : [])))].sort();
  const allStatus = ['Pendente', 'Testando', 'Aguardando Correção', 'Testado'];

  // Lógica de Filtro
  const filteredDemandas = demandas.filter(demanda => {
    const term = searchTerm.toLowerCase();
    const idMatch = demanda.demandaId && demanda.demandaId.toLowerCase().includes(term);
    const nomeMatch = demanda.nome && demanda.nome.toLowerCase().includes(term);
    const statusMatch = statusFilter === 'Todos' || demanda.status === statusFilter;
    const responsavelMatch = responsavelFilter === 'Todos' || (Array.isArray(demanda.responsaveis) && demanda.responsaveis.some(r => r.name === responsavelFilter));
    return (idMatch || nomeMatch) && statusMatch && responsavelMatch;
  });

  // Lógica de Ordenação
  const sortedDemandas = [...filteredDemandas].sort((a, b) => {
    if (sortOrder === 'alpha') {
      return (a.nome || '').localeCompare(b.nome || '');
    }
    return (b._id || '').localeCompare(a._id || '');
  });

  // Lógica de Paginação
  const pageCount = Math.ceil(sortedDemandas.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedDemandas = sortedDemandas.slice(startIndex, endIndex);

  const handleNextPage = () => { setCurrentPage(prev => Math.min(prev + 1, pageCount)); };
  const handlePrevPage = () => { setCurrentPage(prev => Math.max(prev - 1, 1)); };

  return (
    <div>
      {/* --- Navegação "Migalha de Pão" --- */}
      <nav className="mb-6 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          <Link to="/projects" className="hover:text-blue-600 dark:hover:text-blue-400">Projetos</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-gray-200">Demandas</span>
        </div>
      </nav>

      {/* --- CÁBEÇALHO --- */}
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Demandas</h1>

      {/* --- BARRA DE AÇÕES --- */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">

        {/* Pesquisa */}
        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Pesquisar por ID ou nome..."
            className="w-full input-style"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Seletor de Visualização (Grid/Lista) */}
        <div className="flex items-center border rounded-lg shadow-sm">
          <button onClick={() => setViewMode('grid')} title="Visualização em Grade" className={`p-2 rounded-l-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'}`}>
            <GridIcon />
          </button>
          <button onClick={() => setViewMode('list')} title="Visualização em Lista" className={`p-2 rounded-r-lg border-l border-gray-200 dark:border-slate-600 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'}`}>
            <ListIcon />
          </button>
        </div>

        {/* Botão de Ordenação */}
        <button
          onClick={toggleSortOrder}
          title={sortOrder === 'alpha' ? 'Ordenado por A-Z (clique para ordenar por criação)' : 'Ordenado por Criação (clique para ordenar por A-Z)'}
          className="flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
        >
          <SortIcon />
        </button>

        {/* Popover de Filtros */}
        <Popover className="relative w-full md:w-auto">
          {({ open }) => (
            <>
              <Popover.Button className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-colors ${open ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-600 dark:hover:bg-slate-700'}`}>
                <FilterIcon /> Filtros
              </Popover.Button>
              <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                <Popover.Panel className="absolute z-10 right-0 mt-2 w-72 p-4 bg-white dark:bg-slate-800 shadow-lg rounded-lg border border-gray-200 dark:border-slate-700">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                      <select id="filter-status" className="w-full input-style" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option>Todos</option>
                        {allStatus.map(status => (<option key={status} value={status}>{status}</option>))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="filter-responsavel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Responsável</label>
                      <select id="filter-responsavel" className="w-full input-style" value={responsavelFilter} onChange={(e) => setResponsavelFilter(e.target.value)}>
                        <option>Todos</option>
                        {allResponsaveis.map(resp => (<option key={resp} value={resp}>{resp}</option>))}
                      </select>
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>

        {/* Botão + Nova Demanda */}
        {(user?.role === 'admin' || user?.role === 'qa') && (
          <button
            onClick={openCreateModal}
            className="w-full md:w-auto md:ml-auto px-3 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
          >
            + Nova Demanda
          </button>
        )}
      </div>

      {/* --- RENDERIZAÇÃO CONDICIONAL (GRID vs LISTA) --- */}

      {isLoading && <p>Carregando...</p>}
      {!isLoading && demandas.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 col-span-3">
          {(user?.role === 'admin' || user?.role === 'qa')
            ? 'Nenhuma demanda encontrada. Clique em "Nova Demanda" para começar.'
            : 'Nenhuma Demanda Encontrada.'}
        </p>
      )}
      {!isLoading && demandas.length > 0 && filteredDemandas.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 col-span-3">Nenhuma demanda encontrada para os filtros aplicados.</p>
      )}

      {/* Renderização em Grade */}
      {viewMode === 'grid' && filteredDemandas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedDemandas.map((demanda) => (
            <div
              key={demanda._id}
              className={`relative shadow-md rounded-lg border border-gray-200 dark:border-slate-700 transition-all duration-300 h-full flex flex-col justify-between group ${getDemandaCardBgClass(demanda.status)}`}
            >
              <div className="absolute top-3 right-3 flex gap-1 z-10">
                {demanda.linkDemanda && (
                  <a href={demanda.linkDemanda} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 rounded-full text-gray-400 bg-white/50 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-100 transition-opacity" title="Abrir link da demanda">
                    <LinkIcon />
                  </a>
                )}
                {(user?.role === 'admin' || user?.role === 'qa') && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); openEditModal(demanda); }} className="p-1.5 rounded-full text-gray-400 bg-white/50 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-100 transition-opacity" title="Editar Demanda">
                      <EditIcon />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); openDeleteModal(demanda); }} className="p-1.5 rounded-full text-gray-400 bg-white/50 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-100 transition-opacity" title="Deletar Demanda">
                      <TrashIcon />
                    </button>
                  </>
                )}
              </div>

              <Link to={`/demanda/${demanda._id}/scenarios`} className="block p-5">
                <div>
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-2 ${getDemandaStatusClasses(demanda.status)}`}>
                    {demanda.status}
                  </span>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    <span className="text-blue-600 dark:text-blue-400">[{demanda.demandaId}]</span>: {demanda.nome}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Tempo: {demanda.tempoEstimado || 'N/D'} horas</p>
                </div>
                {Array.isArray(demanda.responsaveis) && demanda.responsaveis.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Responsáveis:</h4>
                    <div className="flex flex-wrap gap-1">
                      {demanda.responsaveis.map((resp) => (
                        <span key={resp._id} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-xs font-medium rounded-full capitalize">
                          {resp.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Renderização em Lista */}
      {viewMode === 'list' && filteredDemandas.length > 0 && (
        <div className="bg-white dark:bg-slate-800 shadow border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 font-semibold text-sm w-48 text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-sm w-24 text-center">ID</th>
                  <th className="px-6 py-3 font-semibold text-sm">Demanda</th>
                  <th className="px-6 py-3 font-semibold text-sm text-right pr-12">Responsáveis</th>
                  <th className="px-6 py-3 font-semibold text-sm text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {paginatedDemandas.map((demanda) => (
                  <tr
                    key={demanda._id}
                    onClick={() => navigate(`/demanda/${demanda._id}/scenarios`)}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getDemandaStatusClasses(demanda.status)}`}>
                        {demanda.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-blue-600 dark:text-blue-400 text-center">
                      [{demanda.demandaId}]
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {demanda.nome}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right pr-12">
                      {Array.isArray(demanda.responsaveis) && demanda.responsaveis.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {demanda.responsaveis.map((resp) => (
                            <span key={resp._id} className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 text-xs font-medium rounded-full capitalize">
                              {resp.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">N/D</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        {demanda.linkDemanda && (
                          <a href={demanda.linkDemanda} target="_blank" rel="noopener noreferrer" title="Abrir link da demanda"
                            className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <LinkIcon />
                          </a>
                        )}
                        {(user?.role === 'admin' || user?.role === 'qa') && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); openEditModal(demanda); }} title="Editar Demanda"
                              className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100">
                              <EditIcon />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); openDeleteModal(demanda); }} title="Deletar Demanda"
                              className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100">
                              <TrashIcon />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CONTROLES DE PAGINAÇÃO (COM BOTÃO VOLTAR) --- */}
      <div className="flex items-center justify-between mt-8">
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 rounded-md border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeftIcon />
            Voltar
          </button>
          {pageCount > 1 && (
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Anterior
            </button>
          )}
        </div>

        {pageCount > 1 && (
          <span className="text-sm text-gray-700 dark:text-gray-400">
            Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{pageCount}</span>
          </span>
        )}

        {pageCount > 1 && (
          <button
            onClick={handleNextPage}
            disabled={currentPage === pageCount}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próxima <ArrowRightIcon />
          </button>
        )}
      </div>

      {/* --- MODAL DA DEMANDA --- */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeModal}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-100 dark:border-slate-700">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                    {demandaToEdit ? 'Editar Demanda' : 'Adicionar Nova Demanda'}
                  </Dialog.Title>
                  <DemandaForm
                    projectId={projectId}
                    demandaToEdit={demandaToEdit}
                    onSaveSuccess={handleSaveSuccess}
                    onClose={closeModal}
                    isModalOpen={isModalOpen}
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* --- MODAL DE DELEÇÃO (NOVO) --- */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Deletar Demanda"
        message={`Tem certeza que deseja deletar a demanda "${demandaToDelete?.nome}"? TODOS os seus cenários serão apagados permanentemente.`}
      />
    </div>
  );
}

export default DemandasListPage;