import React, { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api';

const InstallUpdateModal = ({ isOpen, onClose, version }) => {
    const [isUpdating, setIsUpdating] = useState(false);

    if (!isOpen) return null;

    const handleInstall = async () => {
        setIsUpdating(true);
        try {
            const token = localStorage.getItem('token');
            const response = await api.post('/system/trigger-update', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            toast.success(response.data.message || 'Sistema reiniciando para atualização...');
            setTimeout(() => {
                onClose();
            }, 3000);
        } catch (error) {
            console.error('Update failed:', error);
            const msg = error.response?.data?.message || 'Falha ao despachar atualização.';
            toast.error(msg);
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-200 dark:border-neutral-800 transform transition-all">
                <div className="p-6">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full mb-4">
                        <svg className="w-6 h-6 text-amber-600 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
                        Instalar Atualização v{version}?
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-center mb-6 text-sm">
                        O sistema fechará todas as conexões ativas na empresa e reiniciará. Todos os usuários (QAs e Visualizadores) serão desconectados por cerca de 10 a 20 segundos. <br /><br />
                        <strong className="text-red-600 dark:text-red-400">Garanta que ninguém está com trabalhos não salvos.</strong>
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isUpdating}
                            className="flex-1 px-4 py-2 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-700 transition duration-200 font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleInstall}
                            disabled={isUpdating}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition duration-200 font-medium shadow-lg shadow-blue-500/30"
                        >
                            {isUpdating ? (
                                <>
                                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Instalando...
                                </>
                            ) : (
                                'Sim, Instalar Agora'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallUpdateModal;
