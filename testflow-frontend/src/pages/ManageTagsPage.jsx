import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal'; // 1. IMPORTA O NOVO MODAL

// Ícone de Lixeira
const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
  </svg>
);

function ManageTagsPage() {
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 2. ESTADOS PARA CONTROLAR O MODAL ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Guarda o ID da tag que queremos deletar
  const [tagToDelete, setTagToDelete] = useState(null);

  const fetchTags = async () => { /* ... (nenhuma mudança aqui) ... */ };

  useEffect(() => {
    fetchTags();
  }, []);

  // --- 3. FUNÇÃO QUE ABRE O MODAL ---
  const openDeleteModal = (tagId) => {
    setTagToDelete(tagId); // Guarda o ID
    setIsModalOpen(true); // Abre o modal
  };

  // --- 4. FUNÇÃO QUE O MODAL CHAMA AO CONFIRMAR ---
  const handleConfirmDelete = async () => {
    if (!tagToDelete) return; // Segurança

    try {
      await api.delete(`/tags/${tagToDelete}`);
      toast.success('Tag deletada com sucesso!');
      setTags(tags.filter(tag => tag._id !== tagToDelete));
    } catch (err) {
      toast.error('Erro ao deletar a tag.');
      console.error(err);
    }
    // Não precisamos fechar o modal aqui, o próprio modal já chama onClose
  };

  if (isLoading) { /* ... (Spinner) ... */ }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        Gerenciar Tags
      </h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Tags são criadas automaticamente ao adicioná-las a um projeto. Aqui você pode ver todas as tags em uso e deletar as que não são mais necessárias.
      </p>

      <div className="bg-white dark:bg-neutral-900 shadow border border-gray-200 dark:border-neutral-800 rounded-lg transition-colors">
        <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
          {tags.length === 0 ? (
            <li className="p-4 text-center text-gray-500 dark:text-gray-400">Nenhuma tag criada ainda.</li>
          ) : (
            tags.map(tag => (
              <li key={tag._id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <span className="text-base font-medium text-gray-800 dark:text-gray-200 capitalize">{tag.name}</span>
                <button
                  // 5. O ONCLICK AGORA ABRE O MODAL
                  onClick={() => openDeleteModal(tag._id)}
                  title="Deletar Tag"
                  className="p-1.5 rounded-full text-gray-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <TrashIcon />
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* --- 6. O MODAL RENDERIZADO (ESCONDIDO) --- */}
      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Deletar Tag"
        message="Tem certeza que deseja deletar esta tag? Ela será removida de todos os projetos que a utilizam."
      />
    </div>
  );
}

export default ManageTagsPage;