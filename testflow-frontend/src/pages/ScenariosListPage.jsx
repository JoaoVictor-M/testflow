import { useState, useEffect, Fragment, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import ScenarioForm from '../components/ScenarioForm';
import MantisModal from '../components/MantisModal';
import { Dialog, Transition, Popover } from '@headlessui/react';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

// --- ÍCONES ---
const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
  </svg>
);
const FilterIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
  </svg>
);
const BugIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="7" stroke="#2563EB" strokeWidth="2" />
    <line x1="15" y1="15" x2="21" y2="21" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="10" cy="10" rx="3.5" ry="2.5" fill="#EF4444" />
    <circle cx="10" cy="7.5" r="1.5" fill="#9CA3AF" />
    <line x1="7.5" y1="9" x2="6" y2="8" stroke="#374151" strokeWidth="1" strokeLinecap="round" />
    <line x1="7" y1="10.5" x2="5.5" y2="10.5" stroke="#374151" strokeWidth="1" strokeLinecap="round" />
    <line x1="7.5" y1="12" x2="6" y2="13" stroke="#374151" strokeWidth="1" strokeLinecap="round" />
    <line x1="12.5" y1="9" x2="14" y2="8" stroke="#374151" strokeWidth="1" strokeLinecap="round" />
    <line x1="13" y1="10.5" x2="14.5" y2="10.5" stroke="#374151" strokeWidth="1" strokeLinecap="round" />
    <line x1="12.5" y1="12" x2="14" y2="13" stroke="#374151" strokeWidth="1" strokeLinecap="round" />
  </svg>
);
const ArrowLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);
// --- FIM DOS ÍCONES ---

// Funções de Cor
const getStatusClasses = (status) => {
  switch (status) {
    case 'Passou':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'Com Erro':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default: // Aguardando
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  }
};
const getCardBgClass = (status) => {
  switch (status) {
    case 'Passou':
      return 'bg-green-50 dark:bg-green-900/10';
    case 'Com Erro':
      return 'bg-red-50 dark:bg-red-900/10';
    default: // Aguardando
      return 'bg-white dark:bg-neutral-800';
  }
};


function ScenariosListPage() {
  const [scenarios, setScenarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { demandaId } = useParams();
  const navigate = useNavigate();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isMantisModalOpen, setIsMantisModalOpen] = useState(false);
  const [scenarioEmExecucao, setScenarioEmExecucao] = useState(null);
  const [expandedScenarioId, setExpandedScenarioId] = useState(null);
  const [scenarioToEdit, setScenarioToEdit] = useState(null);
  const [scenarioSearchTerm, setScenarioSearchTerm] = useState('');
  const [scenarioStatusFilter, setScenarioStatusFilter] = useState('Todos');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState(null);
  const { user } = useContext(AuthContext); // [NEW]

  // Funções (completas)
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const scenariosResponse = await api.get(`/scenarios?demandaId=${demandaId}`);
      setScenarios(scenariosResponse.data);
      setError(null);
    } catch (err) {
      setError('Não foi possível carregar os cenários.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => { fetchData(); }, [demandaId]);

  const openCreateScenarioModal = () => {
    setScenarioToEdit(null);
    setIsFormModalOpen(true);
  };
  const openEditScenarioModal = (scenario) => {
    setScenarioToEdit(scenario);
    setIsFormModalOpen(true);
  };
  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setScenarioToEdit(null);
  };
  const openMantisModal = (scenarioId) => {
    setScenarioEmExecucao(scenarioId);
    setIsMantisModalOpen(true);
  };
  const closeMantisModal = () => {
    setScenarioEmExecucao(null);
    setIsMantisModalOpen(false);
  };

  const openDeleteModal = (scenario) => {
    setScenarioToDelete(scenario);
    setIsDeleteModalOpen(true);
  };
  const closeDeleteModal = () => {
    setScenarioToDelete(null);
    setIsDeleteModalOpen(false);
  };
  const handleConfirmDelete = async () => {
    if (!scenarioToDelete) return;
    try {
      await api.delete(`/scenarios/${scenarioToDelete._id}`);
      setScenarios(prev => prev.filter(s => s._id !== scenarioToDelete._id));
      toast.success('Cenário deletado com sucesso!');
    } catch (err) {
      toast.error('Erro ao deletar o cenário.');
      console.error(err);
    }
  };

  const handleScenarioSaveSuccess = (savedScenario, mode) => {
    if (mode === 'create') {
      setScenarios((prev) => [savedScenario, ...prev]);
    } else if (mode === 'update') {
      setScenarios((prev) =>
        prev.map((s) => (s._id === savedScenario._id ? savedScenario : s))
      );
    }
  };
  const handleExecute = async (scenarioId, newStatus) => {
    try {
      const response = await api.patch(`/scenarios/${scenarioId}/status`, {
        status: newStatus,
        mantisLink: '',
      });
      setScenarios((prev) =>
        prev.map((s) => (s._id === scenarioId ? response.data : s))
      );
      toast.success(`Status atualizado para "${newStatus}"`);
    } catch (err) {
      toast.error('Erro ao atualizar o status.');
      console.error(err);
    }
  };
  const handleMantisSubmit = async (mantisLink) => {
    if (!scenarioEmExecucao) return;
    try {
      const response = await api.patch(`/scenarios/${scenarioEmExecucao}/status`, {
        status: 'Com Erro',
        mantisLink: mantisLink,
      });
      setScenarios((prev) =>
        prev.map((s) => (s._id === scenarioEmExecucao ? response.data : s))
      );
      toast.success('Erro reportado com sucesso!');
    } catch (err) {
      toast.error('Erro ao salvar o link do Mantis.');
      console.error(err);
    }
  };
  const toggleScenarioExpand = (scenarioId) => {
    if (expandedScenarioId === scenarioId) {
      setExpandedScenarioId(null);
    } else {
      setExpandedScenarioId(scenarioId);
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

  const allScenarioStatus = ['Aguardando', 'Passou', 'Com Erro'];
  const filteredScenarios = scenarios.filter(scenario => {
    const term = scenarioSearchTerm.toLowerCase();
    const titleMatch = scenario.title && scenario.title.toLowerCase().includes(term);
    const descriptionMatch = scenario.description && scenario.description.toLowerCase().includes(term);
    const statusMatch = scenarioStatusFilter === 'Todos' || scenario.status === scenarioStatusFilter;
    return (titleMatch || descriptionMatch) && statusMatch;
  });

  return (
    <div>
      {/* --- CABEÇALHO (COM CORREÇÃO) --- */}
      <nav className="mb-6 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
          <Link to="/projects" className="hover:text-blue-600 dark:hover:text-blue-400">Projetos</Link>
          <span className="mx-2">/</span>
          {/* A classe 'underline' foi removida e 'hover:underline' foi adicionada */}
          <button
            onClick={() => navigate(-1)}
            className="hover:text-blue-600 dark:hover:text-blue-400"
          >
            Demandas
          </button>
          <span className="mx-2">/</span>
          <span className="text-gray-800 dark:text-gray-200">Cenários</span>
        </div>
      </nav>

      {/* --- BARRA DE AÇÕES --- */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <div className="w-full md:w-1/2">
          <input
            type="text"
            placeholder="Pesquisar cenários..."
            className="w-full input-style"
            value={scenarioSearchTerm}
            onChange={(e) => setScenarioSearchTerm(e.target.value)}
          />
        </div>
        <Popover className="relative w-full md:w-auto">
          {({ open }) => (
            <>
              <Popover.Button
                className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-colors
                            ${open ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700'}`}
              >
                <FilterIcon />
                Filtros
              </Popover.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Popover.Panel className="absolute z-10 right-0 mt-2 w-72 p-4 bg-white dark:bg-neutral-800 shadow-lg rounded-lg border border-gray-200 dark:border-neutral-700">
                  <div>
                    <label htmlFor="filter-status-scenario" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                    <select
                      id="filter-status-scenario"
                      className="w-full input-style"
                      value={scenarioStatusFilter}
                      onChange={(e) => setScenarioStatusFilter(e.target.value)}
                    >
                      <option>Todos</option>
                      {allScenarioStatus.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
        {(user?.role === 'admin' || user?.role === 'qa') && (
          <button
            onClick={openCreateScenarioModal}
            className="w-full md:w-auto md:ml-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
          >
            + Novo Cenário
          </button>
        )}
      </div>

      {/* --- LISTAGEM DE CENÁRIOS --- */}
      <h2 className="text-2xl font-bold mt-10 mb-4 text-gray-800 dark:text-gray-100">Cenários Cadastrados</h2>
      <div className="space-y-3">
        {scenarios.length === 0 && !isLoading && (
          <div className="text-center p-12 bg-white dark:bg-neutral-800 rounded-lg shadow border border-gray-200 dark:border-neutral-700">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Nenhum cenário cadastrado</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              {(user?.role === 'admin' || user?.role === 'qa')
                ? 'Clique em "Novo Cenário" para começar.'
                : 'Nenhum Cenário encontrado.'}
            </p>
          </div>
        )}
        {scenarios.length > 0 && filteredScenarios.length === 0 && (
          <div className="text-center p-12 bg-white dark:bg-neutral-800 rounded-lg shadow border border-gray-200 dark:border-neutral-700">
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">Nenhum resultado</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">Nenhum cenário encontrado para os filtros aplicados.</p>
          </div>
        )}
        {filteredScenarios.map((scenario, index) => {
          const isExpanded = expandedScenarioId === scenario._id;
          return (
            <div
              key={scenario._id}
              className={`shadow rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden ${getCardBgClass(scenario.status)}`}
            >
              <div
                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-800/50 transition-colors ${getCardBgClass(scenario.status)}`}
                onClick={() => toggleScenarioExpand(scenario._id)}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="text-lg font-medium text-gray-500 dark:text-gray-400">{index + 1}.</span>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">{scenario.title}</h3>
                </div>
                <div className="flex items-center space-x-3 flex-shrink-0">
                  {scenario.mantisLink && (
                    <a
                      href={scenario.mantisLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver bug no Mantis"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 rounded-full text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    >
                      <BugIcon />
                    </a>
                  )}
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded-full whitespace-nowrap ${getStatusClasses(scenario.status)}`}
                  >
                    {scenario.status}
                  </span>
                  <span className="text-gray-400">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>
              <Transition
                show={isExpanded}
                enter="transition-all duration-300 ease-out"
                enterFrom="opacity-0 -translate-y-2 max-h-0"
                enterTo="opacity-100 translate-y-0 max-h-screen"
                leave="transition-all duration-200 ease-in"
                leaveFrom="opacity-100 translate-y-0 max-h-screen"
                leaveTo="opacity-0 -translate-y-2 max-h-0"
              >
                <div className="p-5 border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                  <p className="text-gray-700 dark:text-gray-300 mb-3">{scenario.description}</p>
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200">Passos:</h4>
                    <ul className="list-decimal list-inside pl-2 text-gray-600 dark:text-gray-400">
                      {scenario.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200">Resultado Esperado:</h4>
                    <p className="text-gray-600 dark:text-gray-400">{scenario.expectedResult}</p>
                  </div>
                  {scenario.mantisLink && (
                    <div className="mt-3">
                      <h4 className="font-semibold text-red-700 dark:text-red-400">Link do Bug (Mantis):</h4>
                      <a href={scenario.mantisLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">
                        {scenario.mantisLink}
                      </a>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-gray-200 dark:border-neutral-700">
                    {(user?.role === 'admin' || user?.role === 'qa') && (
                      <>
                        <button
                          onClick={() => handleExecute(scenario._id, 'Passou')}
                          className="px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-md hover:bg-green-600"
                        >
                          ✓ Passou
                        </button>
                        <button
                          onClick={() => openMantisModal(scenario._id)}
                          className="px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-md hover:bg-red-600"
                        >
                          ✗ Erro
                        </button>
                        <button
                          onClick={() => handleExecute(scenario._id, 'Aguardando')}
                          className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-600"
                        >
                          ↻ Resetar (Aguardando)
                        </button>
                      </>
                    )}

                    {(user?.role === 'admin' || user?.role === 'qa') && (
                      <div className="flex gap-2 ml-auto">
                        <button
                          onClick={() => openEditScenarioModal(scenario)}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-neutral-700 rounded-md border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-600 transition-colors"
                        >
                          <EditIcon />
                          <span className="hidden sm:inline">Editar</span>
                        </button>
                        <button
                          onClick={() => openDeleteModal(scenario)}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 rounded-md border border-red-200 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                          title="Deletar Cenário"
                        >
                          <TrashIcon />
                          <span className="hidden sm:inline">Deletar</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Transition>
            </div>
          )
        })}
      </div>

      {/* --- BOTÃO VOLTAR --- */}
      <div className="flex items-center justify-start mt-8">
        <button
          onClick={() => navigate(-1)} // Ação de voltar
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-800 rounded-md border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 transition-colors"
        >
          <ArrowLeftIcon />
          Voltar
        </button>
      </div>


      {/* --- OS MODAIS (ESCONDIDOS) --- */}
      <Transition appear show={isFormModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={closeFormModal}>
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/30" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-100 dark:border-neutral-700">
                  <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                    {scenarioToEdit ? 'Editar Cenário' : 'Adicionar Novo Cenário'}
                  </Dialog.Title>
                  <ScenarioForm
                    demandaId={demandaId}
                    scenarioToEdit={scenarioToEdit}
                    onSaveSuccess={handleScenarioSaveSuccess}
                    onClose={closeFormModal}
                    isModalOpen={isFormModalOpen}
                  />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <MantisModal
        isOpen={isMantisModalOpen}
        onClose={closeMantisModal}
        onSubmit={handleMantisSubmit}
      />

      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Deletar Cenário"
        message={`Tem certeza que deseja deletar o cenário "${scenarioToDelete?.title}"? Esta ação é permanente.`}
      />
    </div >
  );
}

export default ScenariosListPage;