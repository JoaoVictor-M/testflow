import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const UserForm = ({ userToEdit, onSaveSuccess, onClose, isModalOpen }) => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'viewer'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isModalOpen) {
            if (userToEdit) {
                setFormData({
                    username: userToEdit.username,
                    password: '', // Senha vazia na edição (só envia se quiser alterar)
                    role: userToEdit.role
                });
            } else {
                setFormData({
                    username: '',
                    password: '',
                    role: 'viewer'
                });
            }
        }
    }, [userToEdit, isModalOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const token = localStorage.getItem('token');
            const config = { headers: { Authorization: `Bearer ${token}` } };

            let response;
            if (userToEdit) {
                // Edit Mode (PUT)
                response = await axios.put(`http://localhost:3000/api/users/${userToEdit._id}`, formData, config);
                toast.success('Usuário atualizado com sucesso!');
                onSaveSuccess(response.data.user, 'update');
            } else {
                // Create Mode (POST - via /auth/register)
                // Note: The AuthContext has a registerUser function but we can call API directly here for consistency or use context.
                // Let's call the API directly to keep it self-contained or better yet use the same endpoint structure logic.
                // Current backend: POST /auth/register
                response = await axios.post('http://localhost:3000/auth/register', formData, config);
                toast.success('Usuário criado com sucesso!');
                // Map response structure if needed. Register endpoint returns { message, user }
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
                <label className="block text-sm font-medium text-gray-700">Usuário</label>
                <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="mt-1 w-full input-style"
                    required
                />
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">
                    {userToEdit ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}
                </label>
                <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="mt-1 w-full input-style"
                    {...(!userToEdit && { required: true })}
                />
                {userToEdit && <p className="text-xs text-gray-500 mt-1">Preencha apenas se desejar alterar a senha.</p>}
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700">Nível de Acesso</label>
                <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="mt-1 w-full input-style"
                >
                    <option value="viewer">Visualizador</option>
                    <option value="admin">Administrador</option>
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
                    {isSubmitting ? 'Salvando...' : (userToEdit ? 'Salvar Alterações' : 'Criar Usuário')}
                </button>
            </div>
        </form>
    );
};

export default UserForm;
