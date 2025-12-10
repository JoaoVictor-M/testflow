import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import CreatableSelect from 'react-select/creatable';

// --- ESTILOS ---
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

// --- SELETOR DE RESPONSÁVEIS ---
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


function DemandaForm({ projectId, demandaToEdit, onSaveSuccess, onClose, isModalOpen }) {
  
  const [demandaId, setDemandaId] = useState('');
  const [nome, setNome] = useState('');
  // --- MUDANÇA: 'tempoEstimado' agora é um número ---
  const [tempoEstimado, setTempoEstimado] = useState(0);
  const [linkDemanda, setLinkDemanda] = useState('');
  const [status, setStatus] = useState('Pendente');
  const [responsaveis, setResponsaveis] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(demandaToEdit);

  useEffect(() => {
    if (isEditing) {
      setDemandaId(demandaToEdit.demandaId);
      setNome(demandaToEdit.nome);
      setTempoEstimado(demandaToEdit.tempoEstimado || 0); // Garante que é um número
      setLinkDemanda(demandaToEdit.linkDemanda || '');
      setStatus(demandaToEdit.status);
      const safeResponsaveis = Array.isArray(demandaToEdit.responsaveis) ? demandaToEdit.responsaveis : [];
      setResponsaveis(safeResponsaveis.map(r => ({
        value: r.name,
        label: r.name
      })));
    } else {
      setDemandaId('');
      setNome('');
      setTempoEstimado(0);
      setLinkDemanda('');
      setStatus('Pendente');
      setResponsaveis([]);
    }
  }, [demandaToEdit, isEditing]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const responsavelNames = responsaveis.map(r => r.value);
    
    const demandaData = { 
      demandaId,
      nome, 
      tempoEstimado: Number(tempoEstimado), // Garante que é enviado como número
      linkDemanda,
      status, 
      responsaveis: responsavelNames,
      project: projectId
    };

    try {
      let response;
      if (isEditing) {
        response = await api.put(`/demandas/${demandaToEdit._id}`, demandaData);
        toast.success('Demanda atualizada com sucesso!');
        onSaveSuccess(response.data, 'update');
      } else {
        response = await api.post('/demandas', demandaData);
        toast.success('Demanda criada com sucesso!');
        onSaveSuccess(response.data, 'create');
      }
      onClose();
    } catch (error) {
      console.error('Erro ao salvar demanda:', error);
      toast.error('Erro ao salvar demanda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        
        {/* Número da Demanda (NOVO) */}
        <div>
          <label htmlFor="dem-id" className="block text-sm font-medium text-gray-700">Número da Demanda (ID)</label>
          <input
            type="text"
            id="dem-id"
            className="mt-1 block w-full input-style"
            placeholder="Ex: PROJ-123"
            value={demandaId}
            onChange={(e) => setDemandaId(e.target.value)}
            required
          />
        </div>

        {/* Nome (Obrigatório) */}
        <div>
          <label htmlFor="dem-nome" className="block text-sm font-medium text-gray-700">Nome da Demanda</label>
          <input
            type="text"
            id="dem-nome"
            className="mt-1 block w-full input-style"
            placeholder="Ex: Implementar novo checkout"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>

        {/* Status (Obrigatório) */}
        <div>
          <label htmlFor="dem-status" className="block text-sm font-medium text-gray-700">Status</label>
          <select
            id="dem-status"
            className="mt-1 block w-full input-style"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option>Pendente</option>
            <option>Testando</option>
            <option>Aguardando Correção</option>
            <option>Testado</option>
          </select>
        </div>
        
        {/* Responsáveis */}
        <div>
          <label htmlFor="dem-responsaveis" className="block text-sm font-medium text-gray-700">Responsáveis</label>
          <ResponsavelSelector
            value={responsaveis}
            onChange={(selectedOptions) => setResponsaveis(selectedOptions)}
            isModalOpen={isModalOpen}
          />
        </div>

        {/* --- TEMPO ESTIMADO (ATUALIZADO) --- */}
        <div>
          <label htmlFor="dem-tempo" className="block text-sm font-medium text-gray-700">Tempo Estimado (em horas)</label>
          <input
            type="number" // Garante que só números sejam digitados
            id="dem-tempo"
            className="mt-1 block w-full input-style"
            placeholder="Ex: 8"
            value={tempoEstimado}
            // Garante que o estado seja atualizado como número
            onChange={(e) => setTempoEstimado(e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
            min="0"
          />
        </div>
        
        {/* Link da Demanda (Opcional) */}
        <div>
          <label htmlFor="dem-link" className="block text-sm font-medium text-gray-700">Link da Demanda (Jira, etc.)</label>
          <input
            type="url"
            id="dem-link"
            className="mt-1 block w-full input-style"
            placeholder="https://jira.suaempresa.com/..."
            value={linkDemanda}
            onChange={(e) => setLinkDemanda(e.target.value)}
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
            {isSubmitting ? 'Salvando...' : (isEditing ? 'Atualizar Demanda' : 'Salvar Demanda')}
          </button>
        </div>
      </div>
    </form>
  );
}

export default DemandaForm;