import { useState, useEffect, Fragment, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Dialog, Transition, Popover } from '@headlessui/react';
import ProjectForm from '../components/ProjectForm';
import ConfirmationModal from '../components/ConfirmationModal';

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
const DuplicateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z" />
    <path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z" />
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
      return 'bg-gray-100 text-gray-800 dark:bg-neutral-700 dark:text-gray-300';
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
      return 'bg-white dark:bg-neutral-800';
  }
};


function ProjectsListPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [isClone, setIsClone] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [tagFilter, setTagFilter] = useState('Todos');
  const [versionFilter, setVersionFilter] = useState('Todos');
  const [serverFilter, setServerFilter] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('projectsSortOrder') || 'creation');

  // --- 3. ESTADOS PARA O MODAL DE DELEÇÃO ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  const { user } = useContext(AuthContext); // [NEW] Contexto Auth

  const ITEMS_PER_PAGE = 10;

  // Funções do Modal (Formulário)
  const closeModal = () => {
    setIsModalOpen(false);
  };
  const openCreateModal = () => {
    setProjectToEdit(null);
    setIsClone(false);
    setIsModalOpen(true);
  };
  const openEditModal = (project) => {
    setProjectToEdit(project);
    setIsClone(false);
    setIsModalOpen(true);
  };
  const openCloneModal = (project) => {
    setProjectToEdit(project);
    setIsClone(true);
    setIsModalOpen(true);
  };

  // --- 4. FUNÇÕES DO MODAL DE DELEÇÃO ---
  const openDeleteModal = (project) => {
    setProjectToDelete(project);
    setIsDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
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
  }, [searchTerm, statusFilter, tagFilter, versionFilter, serverFilter, sortOrder]);

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
  const allVersions = [...new Set(projects.flatMap(p => (Array.isArray(p.versions) ? p.versions.map(v => v.name) : [])))].sort();
  const allServers = [...new Set(projects.flatMap(p => (Array.isArray(p.servers) ? p.servers.map(s => s.name) : [])))].sort();
  const allStatus = ['Não Iniciado', 'Em Andamento', 'Concluído', 'Interrompido'];

  const filteredProjects = projects.filter(project => {
    const term = searchTerm.toLowerCase();
    const titleMatch = project.title && project.title.toLowerCase().includes(term);
    const statusMatch = statusFilter === 'Todos' || project.status === statusFilter;
    const tagMatch = tagFilter === 'Todos' || (Array.isArray(project.tags) && project.tags.some(tag => tag.name === tagFilter));
    const versionMatch = versionFilter === 'Todos' || (Array.isArray(project.versions) && project.versions.some(v => v.name === versionFilter));
    const serverMatch = serverFilter === 'Todos' || (Array.isArray(project.servers) && project.servers.some(s => s.name === serverFilter));
    return titleMatch && statusMatch && tagMatch && versionMatch && serverMatch;
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

        <div className="flex items-center shadow-sm rounded-lg overflow-hidden">
          {/* Botões de Visualização removidos */}
        </div>

        <button
          onClick={toggleSortOrder}
          title={sortOrder === 'alpha' ? 'Ordenado por A-Z (clique para ordenar por criação)' : 'Ordenado por Criação (clique para ordenar por A-Z)'}
          className="flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700 transition-colors"
        >
          <SortIcon />
        </button>

        <Popover className="relative w-full md:w-auto">
          {({ open }) => (
            <>
              <Popover.Button className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-colors ${open ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700'}`}>
                <FilterIcon /> Filtros
              </Popover.Button>
              <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                <Popover.Panel className="absolute z-10 right-0 mt-2 w-72 p-4 bg-white dark:bg-neutral-800 shadow-lg rounded-lg border border-gray-200 dark:border-neutral-700">
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

                    <div>
                      <label htmlFor="filter-version" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Versão</label>
                      <select id="filter-version" className="w-full input-style" value={versionFilter} onChange={(e) => setVersionFilter(e.target.value)}>
                        <option>Todos</option>
                        {allVersions.map(v => (<option key={v} value={v}>{v}</option>))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="filter-server" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Servidor</label>
                      <select id="filter-server" className="w-full input-style" value={serverFilter} onChange={(e) => setServerFilter(e.target.value)}>
                        <option>Todos</option>
                        {allServers.map(s => (<option key={s} value={s}>{s}</option>))}
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



      {filteredProjects.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 shadow border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 dark:bg-neutral-950/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-neutral-700">
                <tr>
                  <th className="px-6 py-3 font-semibold text-sm w-48 text-center">Status</th>
                  <th className="px-6 py-3 font-semibold text-sm">Projeto</th>
                  <th className="px-6 py-3 font-semibold text-sm text-center">Versão</th>
                  <th className="px-6 py-3 font-semibold text-sm text-center">Servidor</th>
                  <th className="px-6 py-3 font-semibold text-sm text-right pr-12">Tags</th>
                  {(user?.role === 'admin' || user?.role === 'qa') && <th className="px-6 py-3 font-semibold text-sm text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-neutral-700">
                {paginatedProjects.map((project) => (
                  <tr
                    key={project._id}
                    onClick={() => navigate(`/project/${project._id}/demandas`)}
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors group cursor-pointer"
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
                    {/* Versões */}
                    <td className="px-6 py-4 text-center">
                      {Array.isArray(project.versions) && project.versions.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {project.versions.map((v) => (
                            <span key={v._id} className="px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 text-xs font-medium rounded-full">
                              {v.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>

                    {/* Servidores */}
                    <td className="px-6 py-4 text-center">
                      {Array.isArray(project.servers) && project.servers.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {project.servers.map((s) => (
                            <span key={s._id} className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs font-medium rounded-full">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openEditModal(project); }} title="Editar Projeto"
                            className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                            <EditIcon />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openCloneModal(project); }} title="Duplicar Projeto"
                            className="p-1.5 rounded-full text-gray-400 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors">
                            <DuplicateIcon />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openDeleteModal(project); }} title="Deletar Projeto"
                            className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
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
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próxima
            <ArrowRightIcon />
          </button>
        </div>
      )}

      {/* --- MODAL DO PROJETO --- */}
      <Transition appear show={isModalOpen} as={Fragment} afterLeave={() => setProjectToEdit(null)}>
        <Dialog as="div" className="relative z-10" onClose={() => { }}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-100 dark:border-neutral-700">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                    {projectToEdit ? (isClone ? 'Duplicar Projeto' : 'Editar Projeto') : 'Adicionar Novo Projeto'}
                  </Dialog.Title>

                  <ProjectForm
                    projectToEdit={projectToEdit}
                    onSaveSuccess={handleSaveSuccess}
                    onClose={closeModal}
                    isModalOpen={isModalOpen}
                    isClone={isClone}
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
        afterLeave={() => setProjectToDelete(null)}
      />
    </div>
  );
}

export default ProjectsListPage;