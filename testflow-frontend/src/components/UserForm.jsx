import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const UserForm = ({ userToEdit, onSaveSuccess, onClose, isModalOpen }) => {
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        email: '',
        role: 'viewer'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isModalOpen) {
            if (userToEdit) {
                setFormData({
                    name: userToEdit.name || '',
                    username: userToEdit.username || '',
                    email: userToEdit.email || '',
                    role: userToEdit.role || 'viewer'
                });
            } else {
                setFormData({
                    name: '',
                    username: '',
                    email: '',
                    role: 'viewer'
                });
            }
        }
    }, [userToEdit, isModalOpen]);

    const handleNameChange = (e) => {
        const newName = e.target.value;
        const updates = { name: newName };

        try {
            if (newName && newName.trim()) {
                const parts = newName.trim().split(/\s+/);
                if (parts.length > 0) {
                    const first = parts[0];
                    const last = parts.length > 1 ? parts[parts.length - 1] : '';

                    const normalize = (str) => {
                        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
                    };

                    let generated = normalize(first);
                    if (last) {
                        generated += `.${normalize(last)}`;
                    }
                    // Only update username if we have a valid generated one
                    if (generated) {
                        updates.username = generated;
                    }
                }
            } else {
                updates.username = '';
            }
        } catch (err) {
            console.error("Error generating username:", err);
            // Don't crash, just don't update username
        }

        setFormData(prev => ({ ...prev, ...updates }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            let response;
            if (userToEdit) {
                response = await axios.put(`http://localhost:3000/api/users/${userToEdit._id}`, formData, config);
                toast.success('Usuário atualizado com sucesso!');
                onSaveSuccess(response.data.user, 'update');
            } else {
                response = await axios.post('http://localhost:3000/auth/register', formData, config);
                toast.success('Usuário criado com sucesso!');
                onSaveSuccess(response.data.user, 'create');
            }
            onClose();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.message || 'Erro ao salvar usuário';
            toast.error(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={handleNameChange}
                    className="mt-1 w-full input-style"
                    required
                    maxLength={100}
                />
            </div>

            <div>
                <div className="flex items-center gap-1 mb-1">
                    <label className="block text-sm font-medium text-gray-700">Usuário</label>
                    {!userToEdit && (
                        <div className="group relative flex items-center cursor-help">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                Um link de definição de senha será enviado para o email cadastrado.
                            </div>
                        </div>
                    )}
                </div>
                <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="mt-1 w-full input-style bg-gray-50"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 w-full input-style"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Nível de Acesso</label>
                <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 w-full input-style"
                >
                    <option value="viewer">Visualizador</option>
                </select>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                    {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    );
};

export default UserForm;
