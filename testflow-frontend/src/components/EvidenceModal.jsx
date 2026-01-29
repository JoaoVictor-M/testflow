import { useState, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import toast from 'react-hot-toast';
import api from '../api';
import ConfirmationModal from './ConfirmationModal';

const EvidenceModal = ({ isOpen, onClose, demanda, onUpdate }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [selectedEvidences, setSelectedEvidences] = useState([]);
    const [previewItem, setPreviewItem] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]); // [NEW] Staging List
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

    // [New] State for Status Revert Warning
    const [showStatusRevertWarning, setShowStatusRevertWarning] = useState(false);
    const [evidenceToDelete, setEvidenceToDelete] = useState(null);

    const fileInputRef = useRef(null);

    const handleFileSelection = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        const validFiles = [];
        let hasLargeFile = false;

        files.forEach(file => {
            if (file.size > 50 * 1024 * 1024) {
                toast.error(`O arquivo "${file.name}" excede o limite de 50MB.`);
                hasLargeFile = true;
            } else {
                validFiles.push(file);
            }
        });

        if (validFiles.length > 0) {
            setPendingFiles(prev => [...prev, ...validFiles]);
        }

        // Clear input to allow re-selecting same files if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Close Request (X button only)
    const handleCloseRequest = () => {
        if (pendingFiles.length > 0) {
            setShowUnsavedWarning(true);
        } else {
            onClose();
        }
    };

    const handleConfirmClose = () => {
        setPendingFiles([]);
        setShowUnsavedWarning(false);
        onClose();
    };

    const handleRemovePendingStr = (index) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Batch Upload Logic
    const handleSave = async () => {
        if (pendingFiles.length === 0) return;

        setIsUploading(true);
        let successCount = 0;
        let lastResponseData = null;

        try {
            // Upload sequentially to ensure order and avoid overwhelming browser/network
            for (const file of pendingFiles) {
                const formData = new FormData();
                formData.append('file', file);

                try {
                    const response = await api.post(`/demandas/${demanda._id}/evidence`, formData, {
                        headers: {
                            'Content-Type': 'multipart/form-data',
                            'X-Demanda-Nome': demanda.nome,
                            'X-Demanda-ID': demanda.demandaId // [NEW] Send friendly ID
                        }
                    });
                    lastResponseData = response.data;
                    successCount++;
                } catch (err) {
                    console.error(`Erro ao subir arquivo ${file.name}:`, err);
                    toast.error(`Erro ao salvar "${file.name}".`);
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} evidência(s) salva(s) com sucesso!`);
                if (lastResponseData) onUpdate(lastResponseData);
                setPendingFiles([]); // Clear all pending if process finishes (could refine to only clear successes)
            }
        } catch (error) {
            console.error('Erro geral no upload:', error);
            toast.error('Erro ao processar uploads.');
        } finally {
            setIsUploading(false);
        }
    };

    // Updated Delete Logic
    const handleDeleteRequest = (evidenceId) => {
        // Check if it's the last evidence and status is 'Testado'
        const isLastEvidence = demanda.evidences.length === 1;
        const isTested = demanda.status === 'Testado';

        if (isLastEvidence && isTested) {
            setEvidenceToDelete(evidenceId);
            setShowStatusRevertWarning(true);
        } else {
            // Proceed directly
            handleDelete(evidenceId);
        }
    };

    const handleConfirmStatusRevert = async () => {
        if (evidenceToDelete) {
            await handleDelete(evidenceToDelete);
            setEvidenceToDelete(null);
            setShowStatusRevertWarning(false);
            // Verify if we need to manually update local status or if onUpdate() handles it.
            // Usually onUpdate(response.data) updates the whole object.
        }
    };

    const handleDelete = async (evidenceId) => {
        try {
            const response = await api.delete(`/demandas/${demanda._id}/evidence/${evidenceId}`);
            toast.success('Evidência removida.');
            // Check for status change toast
            if (response.data.status === 'Pendente' && demanda.status === 'Testado') {
                toast('Status da demanda revertido para Pendente', { icon: 'ℹ️' });
            }
            onUpdate(response.data);
            setSelectedEvidences(prev => prev.filter(id => id !== evidenceId));
        } catch (error) {
            console.error(error);
            toast.error('Erro ao remover evidência.');
        }
    };

    // ... Download and Preview Logic (Keep same) ...
    const handleDownload = async (evidenceId, filename) => {
        try {
            const response = await api.get(`/demandas/${demanda._id}/evidence/${evidenceId}/file`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao baixar arquivo.');
        }
    };

    const handleBatchDownload = () => {
        if (selectedEvidences.length === 0) return;
        selectedEvidences.forEach(evId => {
            const ev = demanda.evidences.find(e => e._id === evId);
            if (ev) handleDownload(evId, ev.originalName);
        });
    };

    const toggleSelection = (id) => {
        setSelectedEvidences(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const closePreview = () => {
        setPreviewItem(null);
        if (previewUrl) {
            window.URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const fetchMediaBlob = async (evidence) => {
        try {
            const response = await api.get(`/demandas/${demanda._id}/evidence/${evidence._id}/file`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: evidence.mimetype }));
            setPreviewUrl(url);
            setPreviewItem(evidence);
        } catch (error) {
            console.error(error);
            toast.error('Erro ao carregar visualização.');
        }
    };

    const handlePreview = (evidence) => {
        const mime = evidence.mimetype;
        if (mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('image/') || mime === 'application/pdf') {
            fetchMediaBlob(evidence);
        } else {
            handleDownload(evidence._id, evidence.originalName);
        }
    };

    if (!demanda) return null;

    const DownloadIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
    );

    const UploadIcon = () => (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
    );

    return (
        <>
            <Transition appear show={isOpen} as={Fragment}>
                <Dialog as="div" className="relative z-10" onClose={() => { }}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/30" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-800 p-6 text-left align-middle shadow-xl transition-all border border-gray-100 dark:border-neutral-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100">
                                            Evidências de Teste - {demanda.nome}
                                        </Dialog.Title>
                                        <button onClick={handleCloseRequest} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                            <span className="sr-only">Fechar</span>
                                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="mt-4 min-h-[300px] max-h-[500px] overflow-y-auto border border-gray-200 dark:border-neutral-700 rounded-lg p-2 bg-gray-50 dark:bg-neutral-900/50">
                                        {demanda.evidences && demanda.evidences.length > 0 ? (
                                            <ul className="space-y-2">
                                                {/* LISTA DE EVIDÊNCIAS JÁ SALVAS */}
                                                {demanda.evidences.map((ev) => (
                                                    <li key={ev._id} className="flex items-center justify-between p-3 bg-white dark:bg-neutral-800 rounded-lg shadow-sm border border-gray-100 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-700/50 transition-colors">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedEvidences.includes(ev._id)}
                                                                onChange={() => toggleSelection(ev._id)}
                                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <div className="flex items-center gap-2 cursor-pointer min-w-0" onClick={() => handlePreview(ev)}>
                                                                <span className="text-gray-500">
                                                                    {ev.mimetype.includes('image') ? '🖼️' :
                                                                        ev.mimetype.includes('video') ? '🎥' :
                                                                            ev.mimetype.includes('audio') ? '🎵' :
                                                                                ev.mimetype.includes('pdf') ? '📄' : '📎'}
                                                                </span>
                                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={ev.originalName}>
                                                                    {ev.originalName}
                                                                </span>
                                                                <span className="text-xs text-gray-400">({(ev.size / 1024).toFixed(1)} KB)</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <button
                                                                onClick={() => handleDeleteRequest(ev._id)}
                                                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}

                                        {/* LISTA DE ARQUIVOS PENDENTES (STAGING) */}
                                        {pendingFiles.map((file, index) => (
                                            <li key={`pending-${index}`} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow-sm border border-yellow-200 dark:border-yellow-800/30">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <span className="text-yellow-500 flex items-center justify-center w-4" title="Não salvo">
                                                        ⚠️
                                                    </span>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-gray-500">📎</span>
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate" title={file.name}>
                                                            {file.name}
                                                        </span>
                                                        <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
                                                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-semibold px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 rounded-full">
                                                            Não salvo
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        onClick={() => handleRemovePendingStr(index)}
                                                        className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                        title="Remover da lista"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </li>
                                        ))}

                                        {(!demanda.evidences || demanda.evidences.length === 0) && pendingFiles.length === 0 && (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 py-12">
                                                <svg className="h-12 w-12 mb-2 text-gray-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <p>Nenhuma evidência anexada.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-6 flex justify-between items-center bg-gray-50 dark:bg-neutral-900/30 p-4 rounded-lg border border-gray-100 dark:border-neutral-800">
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {pendingFiles.length > 0
                                                ? `${pendingFiles.length} arquivos aguardando salvar`
                                                : selectedEvidences.length > 0
                                                    ? `${selectedEvidences.length} selecionado(s)`
                                                    : 'Nenhum arquivo pendente'}
                                        </div>
                                        <div className="flex gap-3">
                                            {selectedEvidences.length > 0 && (
                                                <button
                                                    onClick={handleBatchDownload}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                                >
                                                    <DownloadIcon />
                                                    Download
                                                </button>
                                            )}

                                            <input
                                                type="file"
                                                multiple // [NEW] Multiple allow
                                                ref={fileInputRef}
                                                onChange={handleFileSelection}
                                                className="hidden"
                                                accept="image/*,video/*,audio/*,.pdf"
                                            />

                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-600 hover:bg-gray-50 dark:hover:bg-neutral-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"
                                                title="Carregar Arquivos"
                                            >
                                                <UploadIcon />
                                                Upload
                                            </button>

                                            {pendingFiles.length > 0 && (
                                                <button
                                                    onClick={handleSave}
                                                    disabled={isUploading}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isUploading ? (
                                                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    Salvar ({pendingFiles.length})
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>

            <ConfirmationModal
                isOpen={showUnsavedWarning}
                onClose={() => setShowUnsavedWarning(false)}
                onConfirm={handleConfirmClose}
                title="Dados não salvos"
                message="Você tem arquivos na lista de espera que não foram salvos. Se sair agora, eles serão descartados. Deseja sair mesmo assim?"
                confirmText="Sair sem salvar"
                cancelText="Voltar"
            />

            {/* New Status Revert Warning */}
            <ConfirmationModal
                isOpen={showStatusRevertWarning}
                onClose={() => setShowStatusRevertWarning(false)}
                onConfirm={handleConfirmStatusRevert}
                title="Alteração de Status"
                message="Esta é a última evidência desta demanda e ela está marcada como 'Testado'. Ao excluir esta evidência, o status da demanda voltará automaticamente para 'Pendente'. Deseja continuar?"
                confirmText="Sim, excluir e reverter"
                cancelText="Cancelar"
            />

            <Transition appear show={!!previewItem} as={Fragment}>
                <Dialog as="div" className="relative z-50" onClose={closePreview}>
                    <Transition.Child
                        as={Fragment}
                        enter="ease-out duration-300"
                        enterFrom="opacity-0"
                        enterTo="opacity-100"
                        leave="ease-in duration-200"
                        leaveFrom="opacity-100"
                        leaveTo="opacity-0"
                    >
                        <div className="fixed inset-0 bg-black/80" />
                    </Transition.Child>

                    <div className="fixed inset-0 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center">
                            <Transition.Child
                                as={Fragment}
                                enter="ease-out duration-300"
                                enterFrom="opacity-0 scale-95"
                                enterTo="opacity-100 scale-100"
                                leave="ease-in duration-200"
                                leaveFrom="opacity-100 scale-100"
                                leaveTo="opacity-0 scale-95"
                            >
                                <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-2xl bg-black p-1 shadow-2xl transition-all relative">
                                    <button onClick={closePreview} className="absolute top-4 right-4 text-white hover:text-gray-300 z-10 bg-black/50 rounded-full p-2">
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>

                                    <div className="flex items-center justify-center min-h-[50vh] max-h-[85vh]">
                                        {previewItem && previewUrl && (
                                            <>
                                                {previewItem.mimetype.startsWith('image/') && (
                                                    <img
                                                        src={previewUrl}
                                                        alt={previewItem.originalName}
                                                        className="max-w-full max-h-[85vh] object-contain"
                                                    />
                                                )}
                                                {previewItem.mimetype.startsWith('video/') && (
                                                    <video controls className="max-w-full max-h-[85vh]">
                                                        <source src={previewUrl} type={previewItem.mimetype} />
                                                        Seu navegador não suporta a visualização deste vídeo.
                                                    </video>
                                                )}
                                                {previewItem.mimetype.startsWith('audio/') && (
                                                    <audio controls className="w-full max-w-md">
                                                        <source src={previewUrl} type={previewItem.mimetype} />
                                                        Seu navegador não suporta a visualização deste áudio.
                                                    </audio>
                                                )}
                                                {previewItem.mimetype === 'application/pdf' && (
                                                    <iframe
                                                        src={previewUrl}
                                                        className="w-full h-[85vh]"
                                                        title="PDF Preview"
                                                    />
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {previewItem && (
                                        <div className="text-white text-center py-2 text-sm">
                                            {previewItem.originalName}
                                        </div>
                                    )}
                                </Dialog.Panel>
                            </Transition.Child>
                        </div>
                    </div>
                </Dialog>
            </Transition>
        </>
    );
};

export default EvidenceModal;
