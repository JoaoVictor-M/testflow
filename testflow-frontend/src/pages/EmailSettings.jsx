import { useState, useEffect, useContext } from 'react';
import api from '../api';
import { AuthContext } from '../context/AuthContext';
import toast from 'react-hot-toast';

function EmailSettings() {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        host: '',
        port: '',
        user: '',
        pass: '',
        secure: false,
        from: ''
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/config/email', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setFormData(response.data);
        } catch (error) {
            console.error('Erro ao buscar configurações:', error);
            toast.error('Erro ao carregar configurações de email.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put('/config/email', formData, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Configurações salvas com sucesso!');
            fetchSettings();
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
            toast.error(error.response?.data?.message || 'Erro ao salvar configurações.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="text-center mt-10">Carregando...</div>;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-neutral-100">Configurações de Email (SMTP)</h1>

            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-6 transition-colors border border-gray-200 dark:border-neutral-800">
                <form onSubmit={handleSubmit} className="space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host SMTP</label>
                            <input
                                type="text"
                                name="host"
                                value={formData.host}
                                onChange={handleChange}
                                placeholder="smtp.example.com"
                                className="w-full input-style"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Porta</label>
                            <input
                                type="text"
                                name="port"
                                value={formData.port}
                                onChange={handleChange}
                                placeholder="587"
                                className="w-full input-style"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário (Email)</label>
                            <input
                                type="text"
                                name="user"
                                value={formData.user}
                                onChange={handleChange}
                                placeholder="exemplo@exemplo.com"
                                className="w-full input-style"
                            />
                        </div>

                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
                                <div className="group relative flex items-center cursor-help">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                        Deixe em branco para manter a senha atual.
                                    </div>
                                </div>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="pass"
                                    value={formData.pass}
                                    onChange={handleChange}
                                    placeholder="********"
                                    className="w-full input-style pr-10"
                                />
                                {formData.pass && formData.pass !== '********' && (
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                        tabIndex="-1"
                                    >
                                        {showPassword ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <div className="flex items-center gap-1 mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email de Envio (From)</label>
                                <div className="group relative flex items-center cursor-help">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-50">
                                        Define quem aparece como remetente da mensagem. Alguns provedores exigem que seja igual ao usuário autenticado.
                                    </div>
                                </div>
                            </div>
                            <input
                                type="text"
                                name="from"
                                value={formData.from}
                                onChange={handleChange}
                                placeholder="Exemplo <exemplo@exemplo.com>"
                                className="w-full input-style"
                            />
                        </div>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="secure"
                            id="secure"
                            checked={formData.secure}
                            onChange={handleChange}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="secure" className="ml-2 block text-sm text-gray-900 dark:text-gray-200">
                            Usar conexão segura (SSL/TLS)
                        </label>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-neutral-800">
                        <button
                            type="submit"
                            disabled={saving}
                            className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default EmailSettings;
