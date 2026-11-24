import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast/headless';
import DeveloperCreditsModal from '../components/DeveloperCreditsModal';
import HelpTooltip from '../components/HelpTooltip';

const APP_BASE_PATH = (import.meta.env.BASE_URL || '/testflow/').replace(/\/+$/, '') || '/testflow';
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

function ResetPassword() {
    const { token: paramToken } = useParams();
    const navigate = useNavigate();
    const mountedRef = useRef(true);

    const [token] = useState(paramToken || '');
    const [validationState, setValidationState] = useState(paramToken ? 'validating' : 'invalid');
    const [validationMessage, setValidationMessage] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showCreditsModal, setShowCreditsModal] = useState(false);

    const [userData, setUserData] = useState(null);

    const validateToken = useCallback(async () => {
        if (!token) {
            setValidationState('invalid');
            return;
        }
        setValidationState('validating');
        setValidationMessage('');
        try {
            const response = await api.get(`/auth/validate-reset-token/${encodeURIComponent(token)}`);
            if (!mountedRef.current) return;
            if (response.data?.valid) {
                setUserData({ name: response.data.name, username: response.data.username });
                setValidationState('valid');
                window.history.replaceState(null, '', `${APP_BASE_PATH}/reset-password`);
            } else {
                setValidationState('invalid');
            }
        } catch (error) {
            if (!mountedRef.current) return;
            const status = error?.response?.status;
            if (status === 400 || status === 404) {
                setValidationState('invalid');
            } else if (status === 429) {
                setValidationState('rate_limited');
                setValidationMessage(error.response?.data?.message || 'Muitas tentativas. Aguarde alguns instantes e tente novamente.');
            } else {
                setValidationState('network_error');
                setValidationMessage('Não foi possível validar o link no momento. Verifique sua conexão e tente novamente.');
            }
        }
    }, [token]);

    useEffect(() => {
        mountedRef.current = true;
        validateToken();
        return () => {
            mountedRef.current = false;
        };
    }, [validateToken]);

    const goToLogin = (state) => {
        window.history.replaceState(null, '', APP_BASE_PATH);
        navigate('/login', { replace: true, state });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('As senhas não coincidem.');
            return;
        }

        if (!PASSWORD_REGEX.test(password)) {
            toast.error('A senha não atende aos requisitos de segurança.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (!token) {
                toast.error('Token inválido ou perdido. Por favor, clique no link do email novamente.');
                return;
            }

            await api.post('/auth/reset-password', {
                token,
                newPassword: password
            });
            goToLogin({ resetSuccessMessage: 'Senha redefinida com sucesso. Faça login com sua nova senha.' });
        } catch (error) {
            if (!error.response) {
                toast.error('Não foi possível conectar ao servidor. Tente novamente.');
            } else if (error.response.status === 400) {
                toast.error(error.response?.data?.message || 'Token inválido ou expirado');
                setValidationState('invalid');
            } else {
                toast.error(error.response?.data?.message || 'Erro ao redefinir a senha.');
            }
        } finally {
            if (mountedRef.current) {
                setIsSubmitting(false);
            }
        }
    };

    if (validationState === 'validating') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 overflow-hidden transition-colors p-4">
                <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-gray-100 dark:border-neutral-800 p-8 text-center transition-colors">
                    <div className="flex justify-center mb-4">
                        <div className="w-10 h-10 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-500 rounded-full animate-spin" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">Validando link de redefinição...</p>
                </div>
            </div>
        );
    }

    if (validationState === 'network_error' || validationState === 'rate_limited') {
        const heading = validationState === 'rate_limited'
            ? 'Limite temporário atingido'
            : 'Não foi possível validar o link';
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 overflow-hidden transition-colors p-4">
                <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-gray-100 dark:border-neutral-800 p-8 text-center transition-colors">
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{heading}</h2>
                    <p role="alert" className="text-gray-600 dark:text-gray-300 mb-6">{validationMessage}</p>
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={validateToken}
                            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                        >
                            Tentar novamente
                        </button>
                        <button
                            type="button"
                            onClick={() => goToLogin()}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium text-sm"
                        >
                            Voltar para Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (validationState !== 'valid') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-950 overflow-hidden transition-colors p-4">
                <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-lg shadow-md border border-gray-100 dark:border-neutral-800 p-8 text-center transition-colors">
                    <div className="flex justify-center mb-6">
                        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 dark:text-red-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Link Inválido ou Expirado</h2>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">Não foi possível verificar a solicitação de redefinição de senha.</p>
                    <button
                        type="button"
                        onClick={() => goToLogin()}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                    >
                        Voltar para Login
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-neutral-950 overflow-hidden transition-colors p-4">
            <div className="max-w-lg w-full bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-gray-100 dark:border-neutral-800 p-8 sm:p-10 transition-colors backdrop-blur-sm">
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                </div>

                <h2 className="text-center text-2xl font-bold text-gray-900 dark:text-white mb-2">Nova Senha</h2>
                {userData && (
                    <p className="text-center text-gray-600 dark:text-gray-400 mb-8 text-sm">
                        Olá <strong className="text-gray-900 dark:text-white font-semibold">{userData.name}</strong>
                    </p>
                )}

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="relative group">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">Nova Senha</label>
                            <HelpTooltip label="Requisitos da senha">
                                <p className="font-bold mb-2 text-sm text-blue-200">Sua senha deve conter:</p>
                                <ul className="space-y-1 text-gray-300">
                                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-400 rounded-full"></div>Mínimo 8 caracteres</li>
                                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-400 rounded-full"></div>Uma letra maiúscula</li>
                                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-400 rounded-full"></div>Uma letra minúscula</li>
                                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-400 rounded-full"></div>Um número</li>
                                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-blue-400 rounded-full"></div>Um caractere especial (@$!%*?&)</li>
                                </ul>
                            </HelpTooltip>
                        </div>

                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                className={`w-full input-style pr-10 py-3 ${password && !PASSWORD_REGEX.test(password) ? 'border-red-500 focus:ring-red-500 bg-red-50 dark:bg-red-900/10' : ''}`}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Digite sua nova senha"
                            />
                            <button
                                type="button"
                                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                                onClick={() => setShowPassword(!showPassword)}
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
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Confirmar Senha</label>
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            className="w-full input-style py-3"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onPaste={(e) => e.preventDefault()}
                            placeholder="Confirme sua nova senha"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all transform hover:scale-[1.01] active:scale-[0.99] ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Salvando...
                            </span>
                        ) : 'Definir Senha e Entrar'}
                    </button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-neutral-800 text-center text-xs text-gray-400 dark:text-gray-500">
                    <p>
                        Developed by{' '}
                        <button
                            type="button"
                            onClick={() => setShowCreditsModal(true)}
                            className="text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors focus:outline-none"
                        >
                            João Victor Melo
                        </button>
                    </p>
                </div>
            </div>

            <DeveloperCreditsModal
                isOpen={showCreditsModal}
                onClose={() => setShowCreditsModal(false)}
            />
        </div>
    );
}

export default ResetPassword;
