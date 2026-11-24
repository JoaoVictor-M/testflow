import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Mail } from 'lucide-react';
import DeveloperCreditsModal from '../components/DeveloperCreditsModal';
import HelpTooltip from '../components/HelpTooltip';

const DEFAULT_RECOVERY_MESSAGE = 'Se os dados estiverem corretos, um email de recuperação será enviado.';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [confirmationMessage, setConfirmationMessage] = useState(DEFAULT_RECOVERY_MESSAGE);
    const [error, setError] = useState('');
    const [showCreditsModal, setShowCreditsModal] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.post('/auth/forgot-password', { username, email });
            setConfirmationMessage(response.data?.message || DEFAULT_RECOVERY_MESSAGE);
            setSubmitted(true);
        } catch (err) {
            if (!err.response) {
                setError('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
            } else {
                setError(err.response?.data?.message || 'Erro ao processar solicitação.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4 transition-colors">
                <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800 p-8 text-center transition-colors">
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Verifique seu Email</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {confirmationMessage}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                    >
                        Voltar ao Login
                    </button>

                    <div className="mt-6 pt-6 border-t border-gray-100 dark:border-neutral-800 text-center text-xs text-gray-400 dark:text-gray-500">
                        <p>
                            Developed by{' '}
                            <button
                                onClick={() => setShowCreditsModal(true)}
                                className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors focus:outline-none"
                            >
                                João Victor Melo
                            </button>
                        </p>
                    </div>
                </div>
                <DeveloperCreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 px-4 transition-colors">
            <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800 p-8 transition-colors">
                <div className="mb-6">
                    <Link to="/login" className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4">
                        <ArrowLeft size={16} className="mr-1" /> Voltar
                    </Link>
                    <div className="flex items-center justify-between gap-2">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Esqueceu a senha?</h1>
                        <HelpTooltip label="Ajuda sobre recuperação de senha">
                            <p className="font-bold mb-1.5 text-sm text-blue-200">Como funciona a recuperação</p>
                            <p className="text-gray-300 leading-relaxed">
                                Informe o usuário e o email cadastrados. Por segurança, a mensagem de confirmação não indica se a conta existe. Se não receber o link, aguarde alguns minutos ou procure um administrador.
                            </p>
                        </HelpTooltip>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                        Digite seu usuário e email para receber um link de redefinição.
                    </p>
                </div>

                {error && (
                    <div role="alert" className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm mb-4 border border-red-100 dark:border-red-900/50">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuário</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full input-style"
                            placeholder="Seu nome de usuário"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full input-style"
                            placeholder="seu.email@exemplo.com"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-neutral-800 text-center text-xs text-gray-400 dark:text-gray-500">
                    <p>
                        Developed by{' '}
                        <button
                            onClick={() => setShowCreditsModal(true)}
                            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors focus:outline-none"
                        >
                            João Victor Melo
                        </button>
                    </p>
                </div>
            </div>
            <DeveloperCreditsModal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} />
        </div>
    );
};

export default ForgotPassword;
