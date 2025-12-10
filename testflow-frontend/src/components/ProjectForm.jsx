import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';

// --- ESTILOS PARA OS SELETORES ---
const customSelectStyles = {
  valueContainer: (provided) => ({
    ...provided,
    maxHeight: '100px',
    overflowY: 'auto',
    padding: '6px'
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 9999
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999
  }),
  menuList: (provided) => ({
    ...provided,
    maxHeight: '160px',
    overflowY: 'auto',
  }),
};

// --- COMPONENTE SELETOR DE TAGS ---
const TagSelector = ({ value, onChange, isModalOpen }) => {
  const [tagOptions, setTagOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/tags');
        setTagOptions(response.data.map(tag => ({
          value: tag.name,
          label: tag.name
        })));
      } catch (err) {
        console.error("Erro ao buscar tags", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (isModalOpen) {
      fetchTags();
    }
  }, [isModalOpen]);

  return (
    <CreatableSelect
      isMulti
      isLoading={isLoading}
      options={tagOptions}
      value={value}
      onChange={onChange}
      placeholder="Selecione ou crie tags..."
      formatCreateLabel={(inputValue) => `Criar nova tag: "${inputValue}"`}
      classNamePrefix="react-select"
      styles={customSelectStyles}
      menuPortalTarget={document.body}
    />
  );
};

// --- COMPONENTE SELETOR DE RESPONSÁVEIS (REUTILIZADO) ---
const ResponsavelSelector = ({ value, onChange, isModalOpen }) => {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchResponsaveis = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/responsaveis');
        setOptions(response.data.map(r => ({
          value: r.name,
          label: r.name
        })));
      } catch (err) {
        console.error("Erro ao buscar responsáveis", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (isModalOpen) {
      fetchResponsaveis();
    }
  }, [isModalOpen]);

  return (
    <CreatableSelect
      isMulti
      isLoading={isLoading}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Selecione ou crie responsáveis..."
      formatCreateLabel={(inputValue) => `Criar novo responsável: "${inputValue}"`}
      classNamePrefix="react-select"
      styles={customSelectStyles}
      menuPortalTarget={document.body}
    />
  );
};


function ProjectForm({ projectToEdit, onSaveSuccess, onClose, isModalOpen }) {

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Não Iniciado');
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(projectToEdit);

  useEffect(() => {
    if (isEditing) {
      setTitle(projectToEdit.title);
      setStatus(projectToEdit.status);

      const safeTags = Array.isArray(projectToEdit.tags) ? projectToEdit.tags : [];
      setTags(safeTags.map(tag => ({
        value: tag.name,
        label: tag.name
      })));

    } else {
      setTitle('');
      setStatus('Não Iniciado');
      setTags([]);
    }
  }, [projectToEdit, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Converte de volta para array de strings
    const tagNames = tags.map(tag => tag.value);

    const projectData = {
      title,
      status,
      tags: tagNames,
    };

    try {
      let response;
      if (isEditing) {
        response = await api.put(`/projects/${projectToEdit._id}`, projectData);
        toast.success('Projeto atualizado com sucesso!');
        onSaveSuccess(response.data, 'update');
      } else {
        response = await api.post('/projects', projectData);
        toast.success('Projeto criado com sucesso!');
        onSaveSuccess(response.data, 'create');
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar projeto:', error);
      toast.error('Erro ao salvar projeto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">

        {/* Título */}
        <div>
          <label htmlFor="proj-title" className="block text-sm font-medium text-gray-700">Título do Projeto</label>
          <input
            type="text"
            id="proj-title"
            className="mt-1 block w-full input-style"
            placeholder="Ex: Novo App de E-commerce"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>



        {/* Status */}
        <div>
          <label htmlFor="proj-status" className="block text-sm font-medium text-gray-700">Status</label>
          <select
            id="proj-status"
            className="mt-1 block w-full input-style"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>Não Iniciado</option>
            <option>Em Andamento</option>
            <option>Concluído</option>
            <option>Interrompido</option>
          </select>
        </div>

        {/* Tags */}
        <div>
          <label htmlFor="proj-tags" className="block text-sm font-medium text-gray-700">Tags</label>
          <TagSelector
            value={tags}
            onChange={(selectedOptions) => setTags(selectedOptions)}
            isModalOpen={isModalOpen}
          />
        </div>

        {/* Botões */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Salvando...' : (isEditing ? 'Atualizar Projeto' : 'Salvar Projeto')}
          </button>
        </div>
      </div>
    </form>
  );
}

export default ProjectForm;