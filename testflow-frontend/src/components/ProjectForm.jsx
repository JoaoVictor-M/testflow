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

// --- COMPONENTE SELETOR DE VERSÕES ---
const VersionSelector = ({ value, onChange, isModalOpen }) => {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/versions');
        setOptions(response.data.map(v => ({
          value: v.name,
          label: v.name
        })));
      } catch (err) {
        console.error("Erro ao buscar versões", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (isModalOpen) {
      fetchVersions();
    }
  }, [isModalOpen]);

  return (
    <CreatableSelect
      isMulti
      isLoading={isLoading}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Selecione ou crie versões..."
      formatCreateLabel={(inputValue) => `Criar nova versão: "${inputValue}"`}
      classNamePrefix="react-select"
      styles={customSelectStyles}
      menuPortalTarget={document.body}
    />
  );
};

// --- COMPONENTE SELETOR DE SERVIDORES ---
const ServerSelector = ({ value, onChange, isModalOpen }) => {
  const [options, setOptions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchServers = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/servers');
        setOptions(response.data.map(s => ({
          value: s.name,
          label: s.name
        })));
      } catch (err) {
        console.error("Erro ao buscar servidores", err);
      } finally {
        setIsLoading(false);
      }
    };
    if (isModalOpen) {
      fetchServers();
    }
  }, [isModalOpen]);

  return (
    <CreatableSelect
      isMulti
      isLoading={isLoading}
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Selecione ou crie servidores..."
      formatCreateLabel={(inputValue) => `Criar novo servidor: "${inputValue}"`}
      classNamePrefix="react-select"
      styles={customSelectStyles}
      menuPortalTarget={document.body}
    />
  );
};


function ProjectForm({ projectToEdit, onSaveSuccess, onClose, isModalOpen, isClone }) {

  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Não Iniciado');
  const [tags, setTags] = useState([]);
  const [versions, setVersions] = useState([]);
  const [servers, setServers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(projectToEdit);

  useEffect(() => {
    if (isEditing) {
      if (isClone) {
        setTitle(`${projectToEdit.title} (Cópia)`);
        setStatus(projectToEdit.status); // Keep original status or reset? Plan said keep.
      } else {
        setTitle(projectToEdit.title);
        setStatus(projectToEdit.status);
      }

      const safeTags = Array.isArray(projectToEdit.tags) ? projectToEdit.tags : [];
      setTags(safeTags.map(tag => ({
        value: tag.name,
        label: tag.name
      })));

      const safeVersions = Array.isArray(projectToEdit.versions) ? projectToEdit.versions : [];
      setVersions(safeVersions.map(v => ({
        value: v.name,
        label: v.name
      })));

      const safeServers = Array.isArray(projectToEdit.servers) ? projectToEdit.servers : [];
      setServers(safeServers.map(s => ({
        value: s.name,
        label: s.name
      })));

    } else {
      setTitle('');
      setStatus('Não Iniciado');
      setTags([]);
      setVersions([]);
      setServers([]);
    }
  }, [projectToEdit, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Converte de volta para array de strings
    const tagNames = tags.map(tag => tag.value);
    const versionNames = versions.map(v => v.value);
    const serverNames = servers.map(s => s.value);

    const projectData = {
      title,
      status,
      tags: tagNames,
      versions: versionNames,
      servers: serverNames,
    };

    try {
      let response;
      if (isEditing && !isClone) {
        response = await api.put(`/projects/${projectToEdit._id}`, projectData);
        toast.success('Projeto atualizado com sucesso!');
        onSaveSuccess(response.data, 'update');
      } else {
        const payload = isClone ? { ...projectData, sourceId: projectToEdit._id } : projectData;
        response = await api.post('/projects', payload);
        toast.success(isClone ? 'Projeto duplicado com sucesso!' : 'Projeto criado com sucesso!');
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
          <label htmlFor="proj-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Título do Projeto</label>
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
          <label htmlFor="proj-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
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
          <label htmlFor="proj-tags" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tags</label>
          <TagSelector
            value={tags}
            onChange={(selectedOptions) => setTags(selectedOptions)}
            isModalOpen={isModalOpen}
          />
        </div>

        {/* Versões */}
        <div>
          <label htmlFor="proj-versions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Versão</label>
          <VersionSelector
            value={versions}
            onChange={(selectedOptions) => setVersions(selectedOptions)}
            isModalOpen={isModalOpen}
          />
        </div>

        {/* Servidores */}
        <div>
          <label htmlFor="proj-servers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Servidor</label>
          <ServerSelector
            value={servers}
            onChange={(selectedOptions) => setServers(selectedOptions)}
            isModalOpen={isModalOpen}
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
            {isSubmitting ? 'Salvando...' : (isEditing && !isClone ? 'Atualizar Projeto' : (isClone ? 'Duplicar Projeto' : 'Salvar Projeto'))}
          </button>
        </div>
      </div>
    </form>
  );
}

export default ProjectForm;