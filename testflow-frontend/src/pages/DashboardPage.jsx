import { useState, useEffect } from 'react';
import api from '../api';
import { 
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

// Ícone de Card
const CardIcon = ({ iconColor, path }) => (
  <div className={`rounded-full p-3 ${iconColor}`}>
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  </div>
);

// Componente "Card" reutilizável
function StatCard({ title, value, icon }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 flex items-center space-x-4" title={title}>
      {icon}
      <div>
        <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
        <dd className="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
      </div>
    </div>
  );
}

// Componente Lista de Estatísticas
function StatList({ title, data, unit = '', color = 'text-blue-600' }) {
  // Filtra itens onde _id não é null ou undefined e o count é maior que 0
  const validData = data.filter(item => item._id && item.count > 0);

  return (
    <div className="bg-white p-6 rounded-lg shadow border border-gray-200 h-full" title={title}>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">{title}</h2>
      {validData.length > 0 ? (
        <ul className="space-y-3">
          {validData.map((item, index) => (
            <li key={item._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
              <span className="font-medium text-gray-800 capitalize truncate" title={item._id}>
                {index + 1}. {item._id}
              </span>
              <span className={`font-semibold ${color}`}>
                {item.count} {unit}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 text-center py-10">Nenhum dado encontrado.</p>
      )}
    </div>
  );
}

// Cores para os gráficos de pizza
const COLORS_SCENARIO = {
  'Passou': '#10B981',     // Verde
  'Com Erro': '#EF4444',   // Vermelho
  'Aguardando': '#F59E0B', // Amarelo
};
const COLORS_DEMANDA = {
  'Testado': '#10B981',
  'Aguardando Correção': '#F59E0B',
  'Testando': '#3B82F6',
  'Pendente': '#6B7280',
};
const COLORS_PROJECT = {
  'Concluído': '#10B981',
  'Em Andamento': '#3B82F6',
  'Interrompido': '#EF4444',
  'Não Iniciado': '#6B7280',
};
const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
  if (percent * 100 < 5) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};


function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [filterProjectId, setFilterProjectId] = useState('all');
  const [filterResponsavelId, setFilterResponsavelId] = useState('all');

  const [projectOptions, setProjectOptions] = useState([]);
  const [responsavelOptions, setResponsavelOptions] = useState([]);

  // Busca os dados dos filtros
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [projectRes, respRes] = await Promise.all([
          api.get('/projects'),
          api.get('/responsaveis')
        ]);
        setProjectOptions(projectRes.data);
        setResponsavelOptions(respRes.data);
      } catch (err) {
        console.error("Erro ao buscar dados dos filtros:", err);
      }
    };
    fetchFilterData();
  }, []);

  // Busca as estatísticas (filtradas)
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (filterProjectId !== 'all') {
          params.append('projectId', filterProjectId);
        }
        if (filterResponsavelId !== 'all') {
          params.append('responsavelId', filterResponsavelId);
        }
        
        const response = await api.get(`/stats?${params.toString()}`);
        setStats(response.data);
      } catch (err) {
        console.error("Erro ao buscar estatísticas:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [filterProjectId, filterResponsavelId]);

  if (!stats || isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Prepara os dados para os gráficos
  // const totalPassou = stats.scenariosByStatus['Passou'] || 0; // Removido
  // const totalErro = stats.scenariosByStatus['Com Erro'] || 0;   // Removido
  // const totalExecutados = totalPassou + totalErro;               // Removido
  // const passRate = totalExecutados === 0 ? 0 : (totalPassou / totalExecutados) * 100; // Removido
  
  const statusScenarioData = [
    { name: 'Passou', value: stats.scenariosByStatus['Passou'] || 0 },
    { name: 'Com Erro', value: stats.scenariosByStatus['Com Erro'] || 0 },
    { name: 'Aguardando', value: stats.scenariosByStatus['Aguardando'] || 0 },
  ].filter(entry => entry.value > 0);

  const statusDemandaData = [
    { name: 'Testado', value: stats.demandasByStatus['Testado'] || 0 },
    { name: 'Aguardando Correção', value: stats.demandasByStatus['Aguardando Correção'] || 0 },
    { name: 'Testando', value: stats.demandasByStatus['Testando'] || 0 },
    { name: 'Pendente', value: stats.demandasByStatus['Pendente'] || 0 },
  ].filter(entry => entry.value > 0);

  const horasData = (stats.horasPorProjeto || []).map(item => ({ name: item._id, Horas: item.count }));
  
  const demandasByTester = stats.demandasByTester || [];
  const horasByTester = (stats.horasByTester || []).map(item => ({ _id: item._id, count: item.count }));
  const testandoByTester = (stats.testandoByTester || []).map(item => ({ _id: item._id, count: item.count }));
  const demandasMaisBugs = stats.demandasMaisBugs || [];
  
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
      
      {/* --- BARRA DE FILTROS DO DASHBOARD --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg shadow border border-gray-200">
        <div title="Filtre todos os gráficos por um projeto específico">
          <label htmlFor="filter-projeto" className="block text-sm font-medium text-gray-700">Filtrar por Projeto</label>
          <select
            id="filter-projeto"
            className="w-full input-style"
            value={filterProjectId}
            onChange={(e) => setFilterProjectId(e.target.value)}
          >
            <option value="all">Todos os Projetos</option>
            {projectOptions.map(proj => (
              <option key={proj._id} value={proj._id}>{proj.title}</option>
            ))}
          </select>
        </div>
        <div title="Filtre todos os gráficos por um responsável específico">
          <label htmlFor="filter-responsavel" className="block text-sm font-medium text-gray-700">Filtrar por Responsável</label>
          <select
            id="filter-responsavel"
            className="w-full input-style"
            value={filterResponsavelId}
            onChange={(e) => setFilterResponsavelId(e.target.value)}
          >
            <option value="all">Todos os Responsáveis</option>
            {responsavelOptions.map(resp => (
              <option key={resp._id} value={resp._id} className="capitalize">{resp.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- CARDS DE NÚMEROS (AGORA 3 CARDS) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Taxa de Aprovação REMOVIDA */}
        <StatCard 
          title="Horas Estimadas" 
          value={stats.totalHorasEstimadas}
          icon={<CardIcon iconColor="bg-indigo-500" path="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
        />
        <StatCard 
          title="Total de Demandas" 
          value={stats.totalDemandas}
          icon={<CardIcon iconColor="bg-purple-500" path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
        />
        <StatCard 
          title="Total de Cenários" 
          value={stats.totalScenarios}
          icon={<CardIcon iconColor="bg-blue-500" path="M4 6h16M4 12h16M4 18h16" />}
        />
      </div>

      {/* --- GRÁFICOS E LISTAS (LAYOUT DE 3 COLUNAS) --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Coluna 1: Execução de Cenários (Pizza) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow border border-gray-200" title="Distribuição de status de todos os cenários de teste (Passou, Com Erro, Aguardando)">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Execução de Cenários</h2>
          {statusScenarioData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={statusScenarioData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomizedLabel}
                  >
                    {statusScenarioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_SCENARIO[entry.name] || '#8884d8'} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-gray-500 text-center py-20">Nenhum cenário executado.</p>}
        </div>

        {/* Coluna 2: Status das Demandas (Barras) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow border border-gray-200" title="Distribuição de status de todas as demandas (Pendente, Testando, Aguardando Correção, Testado)">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Status das Demandas</h2>
          {statusDemandaData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={statusDemandaData} layout="horizontal" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" name="Quantidade">
                    {statusDemandaData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_DEMANDA[entry.name] || '#8884d8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-gray-500 text-center py-20">Nenhuma demanda encontrada.</p>}
        </div>
        
        {/* Coluna 3: Demandas por Analista (Lista) */}
        <div className="lg:col-span-1">
          <StatList
            title="Demandas por Analista"
            data={demandasByTester}
            unit={demandasByTester.length === 1 && demandasByTester[0].count === 1 ? 'demanda' : 'demandas'}
            color="text-blue-600"
          />
        </div>
        
        {/* Coluna 4: Horas Estimadas por Analista (Lista) */}
        <div className="lg:col-span-1">
          <StatList
            title="Horas Estimadas por Analista"
            data={horasByTester}
            unit="horas"
            color="text-indigo-600"
          />
        </div>
        
        {/* Coluna 5: Demandas em Teste x Analista (Lista) */}
        <div className="lg:col-span-1">
          <StatList
            title="Demandas em Teste x Analista"
            data={testandoByTester}
            unit={testandoByTester.length === 1 && testandoByTester[0].count === 1 ? 'demanda' : 'demandas'}
            color="text-yellow-600"
          />
        </div>

        {/* Gráfico de Barras (Horas por Projeto) */}
        {filterProjectId === 'all' && horasData.length > 0 && (
          <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow border border-gray-200" title="Horas estimadas totais para cada projeto (visível apenas quando 'Todos os Projetos' está selecionado)">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Horas Estimadas por Projeto</h2>
            <div style={{ width: '100%', height: 300 }}> {/* Altura ajustada */}
              <ResponsiveContainer>
                <BarChart data={horasData} layout="vertical" margin={{ top: 10, right: 100, left: 10, bottom: 20 }}> {/* Margens ajustadas */}
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number" 
                    label={{ value: 'Horas', position: 'insideBottom', offset: -5 }} 
                  />
                  <YAxis dataKey="name" type="category" width={150} interval={0} />
                  <Tooltip />
                  <Bar dataKey="Horas" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Lista (Top 5 Demandas com Erro) */}
        {demandasMaisBugs.length > 0 && (
          <div className="lg:col-span-3 bg-white p-6 rounded-lg shadow border border-gray-200" title="As 5 demandas com a maior contagem de cenários marcados como 'Com Erro'">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Top 5 Demandas com Mais Erros</h2>
            <ul className="space-y-3">
              {demandasMaisBugs.map((dem, index) => (
                <li key={dem._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                  <span className="font-medium text-gray-800 capitalize truncate" title={dem._id}>
                    {index + 1}. <span className="text-blue-600">[{dem.demandaId}]</span> {dem._id}
                  </span>
                  <span className="font-semibold text-red-600">{dem.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}

export default DashboardPage;