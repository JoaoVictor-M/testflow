import { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import axios from 'axios';
import toast from 'react-hot-toast';

const ImportUsersModal = ({ isOpen, closeModal, onImportSuccess }) => {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [importing, setImporting] = useState(false);
    const [errors, setErrors] = useState([]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        if (selectedFile) {
            parseCSV(selectedFile);
        }
    };

    const parseCSV = (file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const lines = text.split('\n').map(line => line.trim()).filter(line => line);

            // Remove header if seemingly present (heuristic: "username" or "email" in first line)
            const firstLine = lines[0]?.toLowerCase();
            const hasHeader = firstLine && (firstLine.includes('username') || firstLine.includes('email'));

            const dataLines = hasHeader ? lines.slice(1) : lines;

            const parsed = dataLines.map((line, index) => {
                const parts = line.split(';');
                if (parts.length < 2) return null; // Skip invalid lines
                const [username, email, role] = parts;
                return {
                    username: username?.trim(),
                    email: email?.trim(),
                    role: role?.trim() || 'viewer'
                };
            }).filter(item => item !== null);

            setPreviewData(parsed);
            validateData(parsed);
        };
        reader.readAsText(file);
    };

    const validateData = (data) => {
        const newErrors = [];
        const uniqueEmails = new Set();
        const uniqueUsernames = new Set();

        data.forEach((user, index) => {
            if (!user.username) newErrors.push(`Linha ${index + 1}: Username ausente.`);
            if (!user.email) newErrors.push(`Linha ${index + 1}: Email ausente.`);
            if (user.role === 'admin') newErrors.push(`Linha ${index + 1}: Criação de 'admin' não permitida.`);
            if (uniqueEmails.has(user.email)) newErrors.push(`Linha ${index + 1}: Email duplicado no arquivo.`);
            if (uniqueUsernames.has(user.username)) newErrors.push(`Linha ${index + 1}: Username duplicado no arquivo.`);

            uniqueEmails.add(user.email);
            uniqueUsernames.add(user.username);
        });
        setErrors(newErrors);
    };

    const handleImport = async () => {
        if (errors.length > 0) return;
        setImporting(true);
        try {
            const response = await axios.post('http://localhost:3000/api/users/import', { users: previewData }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            const { success, failed, details } = response.data.results;

            if (failed > 0) {
                toast.error(`Importação concluída com ${failed} falhas. Verifique o console ou alert.`, { duration: 5000 });
                // Show errors in modal (could be improved to a better UI)
                setErrors(details.filter(d => d.error).map(d => `${d.username}: ${d.error}`));
            } else {
                toast.success(`${success} usuários importados com sucesso!`);
                onImportSuccess(); // Refresh list
                closeModal();
            }
        } catch (error) {
            console.error(error);
            toast.error('Ocorreu um erro ao importar os usuários.');
        } finally {
            setImporting(false);
        }
    };

    const downloadTemplate = () => {
        const content = "username;email;role\njoaosilva;joao@empresa.com;viewer\nmaria;maria@empresa.com;editor";
        const blob = new Blob([content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "modelo_usuarios.csv";
        a.click();
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={() => !importing && closeModal()}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center">
                                    Importar Usuários em Lote
                                    <button onClick={downloadTemplate} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        Baixar Modelo
                                    </button>
                                </Dialog.Title>

                                <div className="mt-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={handleFileChange}
                                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        />
                                        <div className="group relative">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-gray-800 text-white text-xs rounded hidden group-hover:block z-50">
                                                Formato: username;email;role (role opcional, padrão viewer). Admin proibido. Use ; como separador.
                                            </div>
                                        </div>
                                    </div>

                                    {file && (
                                        <div className="border rounded-md overflow-hidden max-h-60 overflow-y-auto mb-4">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usuário</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Permissão</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {previewData.slice(0, 50).map((row, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-4 py-2 text-sm text-gray-900">{row.username}</td>
                                                            <td className="px-4 py-2 text-sm text-gray-500">{row.email}</td>
                                                            <td className="px-4 py-2 text-sm text-gray-500">{row.role}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {previewData.length > 50 && <p className="text-center text-xs text-gray-500 p-2">... e mais {previewData.length - 50} linhas.</p>}
                                        </div>
                                    )}

                                    {errors.length > 0 && (
                                        <div className="mb-4 bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                                            <p className="text-sm font-bold text-red-700 mb-1">Erros encontrados:</p>
                                            <ul className="list-disc list-inside text-sm text-red-600">
                                                {errors.map((err, idx) => <li key={idx}>{err}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="mt-6 flex justify-end gap-3">
                                        <button
                                            type="button"
                                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                                            onClick={closeModal}
                                            disabled={importing}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 ${importing || errors.length > 0 || previewData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={handleImport}
                                            disabled={importing || errors.length > 0 || previewData.length === 0}
                                        >
                                            {importing ? 'Importando...' : `Importar ${previewData.length > 0 ? previewData.length : ''} Usuários`}
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default ImportUsersModal;
