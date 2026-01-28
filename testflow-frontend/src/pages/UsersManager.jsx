import { useState, useEffect, Fragment } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Dialog, Transition, Popover } from '@headlessui/react';
import UserForm from '../components/UserForm';
import ConfirmationModal from '../components/ConfirmationModal';
import ImportUsersModal from '../components/ImportUsersModal';

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
const ArrowLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
);
const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const UsersManager = () => {
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [roleFilter, setRoleFilter] = useState('Todos');
    const [sortOrder, setSortOrder] = useState('alpha');
    const [currentPage, setCurrentPage] = useState(1);

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    // Reset Modal State
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [userToReset, setUserToReset] = useState(null);

    const ITEMS_PER_PAGE = 10;

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:3000/api/users', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
        } catch (error) {
            console.error('Erro ao buscar usuários', error);
            toast.error('Erro ao carregar lista de usuários');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Handlers
    const openCreateModal = () => {
        setUserToEdit(null);
        setIsFormModalOpen(true);
    };
    const openEditModal = (user) => {
        setUserToEdit(user);
        setIsFormModalOpen(true);
    };
    const closeFormModal = () => {
        setIsFormModalOpen(false);
        // Note: setUserToEdit(null) is called via afterLeave prop in the modal
    };

    const openDeleteModal = (user) => {
        setUserToDelete(user);
        setIsDeleteModalOpen(true);
    };
    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        // Note: setUserToDelete(null) is called via afterLeave prop in the modal
    };

    // Reset Handlers
    const openResetModal = (user) => {
        setUserToReset(user);
        setIsResetModalOpen(true);
    };
    const closeResetModal = () => {
        setIsResetModalOpen(false);
        // Note: setUserToReset(null) is called via afterLeave prop in the modal
    };

    const handleConfirmDelete = async () => {
        if (!userToDelete) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:3000/api/users/${userToDelete._id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(prev => prev.filter(u => u._id !== userToDelete._id));
            toast.success('Usuário deletado com sucesso!');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Erro ao deletar usuário');
        }
    };

    const handleConfirmReset = async () => {
        if (!userToReset) return;
        try {
            // Since we removed the direct backend call in handleTriggerReset, we do it here.
            // We use public forgot-password endpoint for now as discussed.
            await axios.post('http://localhost:3000/auth/forgot-password', { username: userToReset.username, email: userToReset.email });
            toast.success(`Email de redefinição enviado para ${userToReset.username}`);
            closeResetModal();
        } catch (error) {
            console.error(error);
            toast.error('Erro ao enviar email de redefinição.');
        }
    };

    const handleSaveSuccess = (savedUser, mode) => {
        if (mode === 'create') {
            setUsers(prev => [...prev, savedUser]);
        } else if (mode === 'update') {
            setUsers(prev => prev.map(u => (u._id === savedUser._id ? savedUser : u)));
        }
    };

    // Filter Logic
    const filteredUsers = users.filter(user => {
        const term = searchTerm.toLowerCase();
        const usernameMatch = user.username.toLowerCase().includes(term);
        const roleMatch = roleFilter === 'Todos' || user.role === roleFilter;
        return usernameMatch && roleMatch;
    });

    // Sort Logic
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        if (sortOrder === 'alpha') {
            return a.username.localeCompare(b.username);
        } else {
            return b._id.localeCompare(a._id);
        }
    });

    // Pagination
    const pageCount = Math.ceil(sortedUsers.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedUsers = sortedUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));
    const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, pageCount));

    return (
        <div>
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gerenciamento de Usuários</h1>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
                <div className="w-full md:w-1/2">
                    <input
                        type="text"
                        placeholder="Pesquisar por nome de usuário..."
                        className="w-full input-style"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <Popover className="relative w-full md:w-auto">
                    {({ open }) => (
                        <>
                            <Popover.Button className={`flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium transition-colors ${open ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700'}`}>
                                <FilterIcon /> Filtros
                            </Popover.Button>
                            <Transition as={Fragment} enter="transition ease-out duration-200" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-150" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                                <Popover.Panel className="absolute z-10 right-0 mt-2 w-72 p-4 bg-white dark:bg-neutral-800 shadow-lg rounded-lg border border-gray-200 dark:border-neutral-700">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Perfil</label>
                                    <select
                                        value={roleFilter}
                                        onChange={(e) => setRoleFilter(e.target.value)}
                                        className="w-full input-style"
                                    >
                                        <option value="Todos">Todos</option>
                                        <option value="qa">QA</option>
                                        <option value="viewer">Visualizador</option>
                                    </select>
                                </Popover.Panel>
                            </Transition>
                        </>
                    )}
                </Popover>

                <button
                    onClick={() => setSortOrder(prev => prev === 'alpha' ? 'creation' : 'alpha')}
                    className="flex w-full md:w-auto items-center justify-center gap-2 px-4 py-2 border rounded-lg shadow-sm text-sm font-medium bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200 dark:border-neutral-600 dark:hover:bg-neutral-700 transition-colors"
                    title={sortOrder === 'alpha' ? "Ordenado por Nome (clique para Recentes)" : "Ordenado por Recentes (clique para Nome)"}
                >
                    <SortIcon />
                </button>

                <div className="flex gap-2 w-full md:w-auto md:ml-auto">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="w-full md:w-auto px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 flex items-center justify-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Importar CSV
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="w-full md:w-auto px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                    >
                        + Novo Usuário
                    </button>
                </div>
            </div>

            <ImportUsersModal
                isOpen={isImportModalOpen}
                closeModal={() => setIsImportModalOpen(false)}
                onImportSuccess={fetchUsers}
            />

            {/* List */}
            {
                isLoading ? (
                    <div className="text-center py-10 text-gray-500">Carregando usuários...</div>
                ) : (
                    <div className="bg-white dark:bg-neutral-900 shadow-md border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-neutral-950/50 text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-neutral-800">
                                    <tr>
                                        <th className="px-6 py-3 font-semibold text-sm">Usuário</th>
                                        <th className="px-6 py-3 font-semibold text-sm">Perfil</th>
                                        <th className="px-6 py-3 font-semibold text-sm text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                                    {paginatedUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                                                Nenhum usuário encontrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedUsers.map((u) => (
                                            <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{u.username}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${u.role === 'admin' ? 'bg-purple-100 text-purple-800' : (u.role === 'qa' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800')}`}>
                                                        {u.role === 'admin' ? 'ADMINISTRADOR' : (u.role === 'qa' ? 'QA' : 'VISUALIZADOR')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditModal(u)}
                                                            className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                                            title="Editar"
                                                        >
                                                            <EditIcon />
                                                        </button>
                                                        <button
                                                            onClick={() => openResetModal(u)}
                                                            className="p-1.5 rounded-full text-gray-400 hover:text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors"
                                                            title="Resetar Senha"
                                                        >
                                                            <ResetIcon />
                                                        </button>
                                                        <button
                                                            onClick={() => openDeleteModal(u)}
                                                            className="p-1.5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                            title="Excluir"
                                                        >
                                                            <TrashIcon />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {/* Pagination */}
            {
                pageCount > 1 && (
                    <div className="flex items-center justify-between mt-6">
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
                )
            }

            {/* Form Modal */}
            <Transition appear show={isFormModalOpen} as={Fragment} afterLeave={() => setUserToEdit(null)}>
                <Dialog as="div" className="relative z-10" onClose={() => { }}>
                    <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                        <div className="fixed inset-0 bg-black/30" />
                    </Transition.Child>
                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-100 dark:border-neutral-700">
                                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
                                        {userToEdit ? 'Editar Usuário' : 'Novo Usuário'}
                                    </Dialog.Title>
                                    <UserForm
                                        userToEdit={userToEdit}
                                        onSaveSuccess={handleSaveSuccess}
                                        onClose={closeFormModal}
                                        isModalOpen={isFormModalOpen}
                                    />
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            {/* Delete Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                onConfirm={handleConfirmDelete}
                title="Excluir Usuário"
                message={`Tem certeza que deseja excluir o usuário "${userToDelete?.username}"? Esta ação não pode ser desfeita.`}
                afterLeave={() => setUserToDelete(null)}
            />

            {/* Reset Modal */}
            <ConfirmationModal
                isOpen={isResetModalOpen}
                onClose={closeResetModal}
                onConfirm={handleConfirmReset}
                title="Resetar Senha"
                message={`Tem certeza que deseja enviar um email de redefinição de senha para o usuário "${userToReset?.username}"?`}
                confirmText="Resetar"
                cancelText="Cancelar"
                confirmButtonClass="bg-yellow-600 hover:bg-yellow-700"
                variant="warning"
                afterLeave={() => setUserToReset(null)}
            />
        </div >
    );
};


export default UsersManager;
