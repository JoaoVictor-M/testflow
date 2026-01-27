import { useState, useEffect, Fragment, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Dialog, Transition, Popover } from '@headlessui/react';
import ProjectForm from '../components/ProjectForm';
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
// 2. NOVO ÍCONE DE LIXEIRA
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);
// --- FIM DOS ÍCONES ---

// Funções de Cor
const getProjectStatusClasses = (status) => {
  switch (status) {
    case 'Concluído':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Em Andamento':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Interrompido':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default: // Não Iniciado
      return 'bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-gray-300';
  }
};
const getProjectCardBgClass = (status) => {
  switch (status) {
    case 'Concluído':
      return 'bg-green-50 dark:bg-green-900/10';
    case 'Em Andamento':
      return 'bg-blue-50 dark:bg-blue-900/10';
    case 'Interrompido':
      return 'bg-red-50 dark:bg-red-900/10';
    default: // Não Iniciado
      return 'bg-white dark:bg-slate-800';
  }
};


function ProjectsListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tagFilter, setTagFilter] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('projectsViewMode') || 'grid');
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('projectsSortOrder') || 'creation');

  // --- 3. ESTADOS PARA O MODAL DE DELEÇÃO ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const { user } = useContext(AuthContext); // [NEW] Contexto Auth

  const ITEMS_PER_PAGE = viewMode === 'grid' ? 9 : 10;

  // Funções do Modal (Formulário)
  const closeModal = () => {
    setIsModalOpen(false);
    setProjectToEdit(null);
  };
  const openCreateModal = () => {
    setProjectToEdit(null);
    setIsModalOpen(true);
  };
  const openEditModal = (project) => {
    setProjectToEdit(project);
    setIsModalOpen(true);
  };

  // --- 4. FUNÇÕES DO MODAL DE DELEÇÃO ---
  const openDeleteModal = (project) => {
    setProjectToDelete(project);
    setIsDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    setProjectToDelete(null);
    setIsDeleteModalOpen(false);
  };
  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    try {
      await api.delete(`/projects/${projectToDelete._id}`);
      // Remove o projeto da lista na tela
      setProjects(prev => prev.filter(p => p._id !== projectToDelete._id));
      toast.success('Projeto deletado com sucesso!');
    } catch (err) {
      toast.error('Erro ao deletar o projeto.');
      console.error(err);
    }
    // O modal já é fechado pelo onConfirm no JSX
  };
  // --- FIM DAS FUNÇÕES DE DELEÇÃO ---

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/projects');
      setProjects(response.data);
      setError(null);
    } catch (err) {
      setError('Não foi possível carregar os projetos.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, tagFilter, viewMode, sortOrder]);

  useEffect(() => {
    localStorage.setItem('projectsViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('projectsSortOrder', sortOrder);
  }, [sortOrder]);

  const toggleSortOrder = () => {
    setSortOrder(current => (current === 'alpha' ? 'creation' : 'alpha'));
  };

  const handleSaveSuccess = (savedProject, mode) => {
    if (mode === 'create') {
      setProjects(prevProjects => [savedProject, ...prevProjects]);
    } else if (mode === 'update') {
      setProjects(prevProjects =>
        prevProjects.map(p => (p._id === savedProject._id ? savedProject : p))
      );
    }
  };

  if (isLoading) { /* ... (Spinner) ... */ }
  if (error) { /* ... (Erro) ... */ }

  const allTags = [...new Set(projects.flatMap(p => (Array.isArray(p.tags) ? p.tags.map(t => t.name) : [])))].sort();
  const allStatus = ['Não Iniciado', 'Em Andamento', 'Concluído', 'Interrompido'];

  const filteredProjects = projects.filter(project => {
    const term = searchTerm.toLowerCase();
    const titleMatch = project.title && project.title.toLowerCase().includes(term);
    const statusMatch = statusFilter === 'Todos' || project.status === statusFilter;
    const tagMatch = tagFilter === 'Todos' || (Array.isArray(project.tags) && project.tags.some(tag => tag.name === tagFilter));
    return titleMatch && statusMatch && tagMatch;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    if (sortOrder === 'alpha') {
      return (a.title || '').localeCompare(b.title || '');
    }
    return (b._id || '').localeCompare(a._id || '');
  });

  const pageCount = Math.ceil(sortedProjects.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedProjects = sortedProjects.slice(startIndex, endIndex);

  const handleNextPage = () => { setCurrentPage(prev => Math.min(prev + 1, pageCount)); };
  const handlePrevPage = () => { setCurrentPage(prev => Math.max(prev - 1, 1)); };

  return (
    <div>
      {/* --- CÁBEÇALHO --- */}
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">Projetos</h1>

      {/* --- BARRA DE AÇÕES --- */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">

        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Pesquisar por Título..."
            className="w-full input-style"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center border rounded-lg shadow-sm">
          <button onClick={() => setViewMode('grid')} title="Visualização em Grade" className={`p-2 rounded-l-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'}`}>
            <GridIcon />
          </button>
          <button onClick={() => setViewMode('list')} title="Visualização em Lista" className={`p-2 rounded-r-lg border-l border-gray-200 dark:border-slate-600 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-400 dark:hover:bg-slate-700'}`}>
            <ListIcon />
          </button>
        </div>

        <button
          onClick={toggleSortOrder}
          title={sortOrder === 'alpha' ? 'Ordenado por A-Z (clique para ordenar por criação)' : 'Ordenado por Criação (clique para ordenar por A-Z)'}
          className="flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-gray-200 dark:border-slate-600 dark:hover:bg-slate-700 transition-colors"
        >
          <SortIcon />
        </button>

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
                      <label htmlFor="filter-tag" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tag</label>
                      <select id="filter-tag" className="w-full input-style" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
                        <option>Todos</option>
                        {allTags.map(tag => (<option key={tag} value={tag}>{tag}</option>))}
                      </select>
                    </div>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>

        {(user?.role === 'admin' || user?.role === 'qa') && (
          <button onClick={openCreateModal} className="w-full md:w-auto md:ml-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
            + Novo Projeto
          </button>
        )}
      </div>

      {/* --- RENDERIZAÇÃO (GRID vs LISTA) --- */}

      {isLoading && <p>Carregando...</p>}
      {!isLoading && projects.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 col-span-3">
          {(user?.role === 'admin' || user?.role === 'qa')
            ? 'Nenhum projeto encontrado. Clique em "Novo Projeto" para começar.'
            : 'Nenhum Projeto Encontrado.'}
        </p>
      )}
      {!isLoading && projects.length > 0 && filteredProjects.length === 0 && (
        <p className="text-gray-600 dark:text-gray-400 col-span-3">Nenhum projeto encontrado para os filtros aplicados.</p>
      )}

      {viewMode === 'grid' && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {paginatedProjects.map((project) => (
            <div
              key={project._id}
              className={`relative shadow-md rounded-lg border border-gray-200 dark:border-slate-700 transition-all duration-300 h-full flex flex-col justify-between group ${getProjectCardBgClass(project.status)}`}
            >
              {/* --- 5. BOTÕES DE AÇÃO DO CARD --- */}
              {(user?.role === 'admin' || user?.role === 'qa') && (
                <div className="absolute top-3 right-3 flex gap-1 z-10">
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openEditModal(project); }}
                    className="p-1.5 rounded-full text-gray-400 bg-white/50 opacity-0 group-hover:opacity-100 hover:text-blue-600 hover:bg-blue-100 transition-opacity"
                    title="Editar Projeto"
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); openDeleteModal(project); }}
                    className="p-1.5 rounded-full text-gray-400 bg-white/50 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-100 transition-opacity"
                    title="Deletar Projeto"
                  >
                    <TrashIcon />
                  </button>
                </div>
              )}

              <Link to={`/project/${project._id}/demandas`} className="block p-5">
                <div>
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full mb-2 ${getProjectStatusClasses(project.status)}`}>
                    {project.status}
                  </span>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{project.title}</h3>
                </div>



                {Array.isArray(project.tags) && project.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <span key={tag._id} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium rounded-full capitalize">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && filteredProjects.length > 0 && (
        <div className="bg-white dark:bg-slate-800 shadow border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 font-semibold text-sm w-48 text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-sm">Projeto</th>
                  <th className="px-6 py-3 font-semibold text-sm text-right pr-12">Tags</th>
                  {(user?.role === 'admin' || user?.role === 'qa') && <th className="px-6 py-3 font-semibold text-sm text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {paginatedProjects.map((project) => (
                  <tr
                    key={project._id}
                    onClick={() => navigate(`/project/${project._id}/demandas`)}
                    className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${getProjectStatusClasses(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400">
                        {project.title}
                      </span>
                    </td>
                    {/* Responsáveis column removed */}
                    <td className="px-6 py-4 text-right pr-12">
                      {Array.isArray(project.tags) && project.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end">
                          {project.tags.map((tag) => (
                            <span key={tag._id} className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs font-medium rounded-full capitalize">
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    {(user?.role === 'admin' || user?.role === 'qa') && (
                      <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(project); }} title="Editar Projeto"
                            className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100">
                            <EditIcon />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openDeleteModal(project); }} title="Deletar Projeto"
                            className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100">
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CONTROLES DE PAGINAÇÃO --- */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeftIcon />
            Anterior
          </button>

          <span className="text-sm text-gray-700 dark:text-gray-400">
            Página <span className="font-semibold">{currentPage}</span> de <span className="font-semibold">{pageCount}</span>
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage === pageCount}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próxima
            <ArrowRightIcon />
          </button>
        </div>
      )}

      {/* --- MODAL DO PROJETO --- */}
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
                    {projectToEdit ? 'Editar Projeto' : 'Adicionar Novo Projeto'}
                  </Dialog.Title>

                  <ProjectForm
                    projectToEdit={projectToEdit}
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

      {/* --- MODAL DE DELEÇÃO --- */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Deletar Projeto"
        message={`Tem certeza que deseja deletar o projeto "${projectToDelete?.title}"? TODAS as suas demandas e cenários serão apagados permanentemente.`}
      />
    </div>
  );
}

export default ProjectsListPage;