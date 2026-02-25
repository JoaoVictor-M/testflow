import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

// 1. RECEBE 'demandaId'
function ScenarioForm({ demandaId, scenarioToEdit, onSaveSuccess, onClose, isClone }) {

  const initialState = {
    title: '',
    description: '',
    steps: '',
    expectedResult: '',
  };

  const [formData, setFormData] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(scenarioToEdit);

  useEffect(() => {
    if (isEditing) {
      if (isClone) {
        setFormData({
          title: `${scenarioToEdit.title} (Cópia)`,
          description: scenarioToEdit.description,
          steps: scenarioToEdit.steps.join('\n'),
          expectedResult: scenarioToEdit.expectedResult,
        });
      } else {
        setFormData({
          title: scenarioToEdit.title,
          description: scenarioToEdit.description,
          steps: scenarioToEdit.steps.join('\n'),
          expectedResult: scenarioToEdit.expectedResult,
        });
      }
    } else {
      setFormData(initialState);
    }
  }, [scenarioToEdit, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const postData = {
      ...formData,
      steps: formData.steps.split('\n'),
      // 2. ENVIA 'demandaId'
      demanda: demandaId,
      ...(isClone && scenarioToEdit ? { sourceId: scenarioToEdit._id } : {})
    };

    try {
      let response;
      if (isEditing && !isClone) {
        response = await api.put(`/scenarios/${scenarioToEdit._id}`, postData);
        toast.success('Cenário atualizado com sucesso!');
        onSaveSuccess(response.data, 'update');
      } else {
        response = await api.post('/scenarios', postData);
        toast.success(isClone ? 'Cenário duplicado com sucesso!' : 'Cenário criado com sucesso!');
        onSaveSuccess(response.data, 'create');
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar cenário:', error);
      toast.error('Erro ao salvar cenário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">

        {/* Título */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Título</label>
          <input
            type="text"
            id="title"
            name="title"
            className="mt-1 block w-full input-style"
            placeholder="Ex: Login com credenciais válidas"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        {/* Descrição */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
          <input
            type="text"
            id="description"
            name="description"
            className="mt-1 block w-full input-style"
            placeholder="O que este cenário testa?"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>

        {/* Passos */}
        <div>
          <label htmlFor="steps" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Passos (um por linha)</label>
          <textarea
            id="steps"
            name="steps"
            rows="4"
            className="mt-1 block w-full input-style"
            placeholder="1. Abrir a página&#10;2. Clicar em Login&#10;3. Preencher..."
            value={formData.steps}
            onChange={handleChange}
            required
          />
        </div>

        {/* Resultado Esperado */}
        <div>
          <label htmlFor="expectedResult" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Resultado Esperado</label>
          <input
            type="text"
            id="expectedResult"
            name="expectedResult"
            className="mt-1 block w-full input-style"
            placeholder="O usuário deve ser redirecionado para o dashboard."
            value={formData.expectedResult}
            onChange={handleChange}
            required
          />
        </div>

        {/* Botões */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-neutral-700 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : (isEditing && !isClone ? 'Atualizar Cenário' : (isClone ? 'Duplicar Cenário' : 'Salvar Cenário'))}
          </button>
        </div>
      </div>
    </form>
  );
}

export default ScenarioForm;