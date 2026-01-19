const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Scenario = require('./models/Scenario');
const Project = require('./models/Project');
const Tag = require('./models/Tag');
const Responsavel = require('./models/Responsavel');
const Demanda = require('./models/Demanda');
const User = require('./models/User'); // [NEW] Import User model
const jwt = require('jsonwebtoken'); // [NEW] Import jwt
const authMiddleware = require('./middleware/authMiddleware'); // [NEW]
const roleMiddleware = require('./middleware/roleMiddleware'); // [NEW]

// CONSTANTS
require('dotenv').config(); // [NEW] Config .env

// CONSTANTS
const JWT_SECRET = process.env.JWT_SECRET || 'testflow_secret_key_12345'; // [NEW] fallback


const app = express();
const PORT = 3000;
app.use(express.json());
app.use(cors());

const MONGO_URI = 'mongodb://mongodb-service:27017/testflow-db';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Conexão com o MongoDB (via Docker) estabelecida!'))
  .catch((error) => console.error('!!!!!! ERRO AO CONECTAR NO MONGO !!!!!!:', error));


// --- FUNÇÕES HELPER ---
const findOrCreateTags = async (tagNames) => {
  if (!tagNames || tagNames.length === 0) return [];
  const uniqueTagNames = [...new Set(tagNames.map(name => name.trim().toLowerCase()))];
  const tagPromises = uniqueTagNames.map(async (name) => {
    const existingTag = await Tag.findOne({ name: name });
    if (existingTag) return existingTag._id;
    const newTag = new Tag({ name: name });
    const savedTag = await newTag.save();
    return savedTag._id;
  });
  return Promise.all(tagPromises);
};

const findOrCreateResponsaveis = async (responsavelNames) => {
  if (!responsavelNames || responsavelNames.length === 0) return [];
  const uniqueNames = [...new Set(responsavelNames.map(name => name.trim().toLowerCase()))];
  const responsavelPromises = uniqueNames.map(async (name) => {
    const existing = await Responsavel.findOne({ name: name });
    if (existing) return existing._id;
    const novo = new Responsavel({ name: name });
    const saved = await novo.save();
    return saved._id;
  });
  return Promise.all(responsavelPromises);
};



// --- ROTAS DE AUTENTICAÇÃO (PÚBLICAS) ---

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Gerar Token
    const payload = {
      userId: user._id,
      username: user.username,
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, user: { username: user.username, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Middleware Global de Proteção (Opcional: aplicar rotas específicas ou globalmente abaixo)
// Vamos aplicar globalmente para /api/*, exceto se definirmos rotas publicas antes.
// Mas para facilitar, vamos injetar o middleware nas definições de rota abaixo.

// --- ROTAS DE GESTÃO DE USUÁRIOS (APENAS ADMIN) ---
app.post('/auth/register', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { username, password, role } = req.body;

    // Validação simples
    if (!username || !password) {
      return res.status(400).json({ message: 'Username e Password são obrigatórios' });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Usuário já existe' });
    }

    const newUser = new User({ username, password, role: role || 'viewer' });
    await newUser.save();

    res.status(201).json({ message: 'Usuário criado com sucesso', user: { username: newUser.username, role: newUser.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- ROTAS DE USUÁRIOS ---
app.get('/api/users', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (username) user.username = username;
    if (role) user.role = role;
    if (password && password.trim() !== '') {
      user.password = password; // O pre-save hook do Mongoose vai fazer o hash
    }

    await user.save();
    res.status(200).json({ message: 'Usuário atualizado com sucesso', user: { _id: user._id, username: user.username, role: user.role } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    // Prevenir auto-deleção
    if (req.user.userId === userId) {
      return res.status(400).json({ message: 'Você não pode deletar a si mesmo.' });
    }

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    res.status(200).json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// --- ROTAS DE PROJETOS (CRUD) ---
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({}).populate('tags').populate('responsaveis');
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/projects', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const tagIds = await findOrCreateTags(req.body.tags);
    const responsavelIds = await findOrCreateResponsaveis(req.body.responsaveis);
    const newProject = new Project({
      title: req.body.title,
      status: req.body.status,
      tags: tagIds,
      responsaveis: responsavelIds
    });
    const savedProject = await newProject.save();
    const populatedProject = await Project.findById(savedProject._id).populate('tags').populate('responsaveis');
    res.status(201).json(populatedProject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/projects/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const tagIds = await findOrCreateTags(req.body.tags);
    const responsavelIds = await findOrCreateResponsaveis(req.body.responsaveis);
    const projectData = {
      title: req.body.title,
      status: req.body.status,
      tags: tagIds,
      responsaveis: responsavelIds
    };
    const updatedProject = await Project.findByIdAndUpdate(req.params.id, projectData, { new: true, runValidators: true });
    if (!updatedProject) return res.status(404).json({ message: 'Projeto não encontrado' });
    const populatedProject = await Project.findById(updatedProject._id).populate('tags').populate('responsaveis');
    res.status(200).json(populatedProject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/projects/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const projectId = req.params.id;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Projeto não encontrado' });
    }
    const demandas = await Demanda.find({ project: projectId });
    const demandaIds = demandas.map(d => d._id);
    await Scenario.deleteMany({ demanda: { $in: demandaIds } });
    await Demanda.deleteMany({ project: projectId });
    await Project.findByIdAndDelete(projectId);
    res.status(200).json({ message: 'Projeto e todos os seus dados (demandas e cenários) deletados.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ROTAS DE TAGS ---
app.get('/api/tags', async (req, res) => {
  try {
    const tags = await Tag.find({}).sort({ name: 1 });
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.delete('/api/tags/:id', async (req, res) => {
  try {
    const tagId = req.params.id;
    await Tag.findByIdAndDelete(tagId);
    await Project.updateMany(
      { tags: tagId },
      { $pull: { tags: tagId } }
    );
    res.status(200).json({ message: 'Tag deletada e removida dos projetos.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ROTAS DE RESPONSÁVEIS ---
app.get('/api/responsaveis', authMiddleware, async (req, res) => {
  try {
    const responsaveis = await Responsavel.find({}).sort({ name: 1 });
    res.status(200).json(responsaveis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ROTAS DE DEMANDAS ---
app.post('/api/demandas', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const responsavelIds = await findOrCreateResponsaveis(req.body.responsaveis);
    const newDemanda = new Demanda({
      demandaId: req.body.demandaId,
      nome: req.body.nome,
      tempoEstimado: req.body.tempoEstimado,
      linkDemanda: req.body.linkDemanda,
      status: req.body.status,
      project: req.body.project,
      responsaveis: responsavelIds
    });
    const savedDemanda = await newDemanda.save();
    const populatedDemanda = await Demanda.findById(savedDemanda._id).populate('responsaveis');
    res.status(201).json(populatedDemanda);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.get('/api/demandas', authMiddleware, async (req, res) => {
  try {
    const projectId = req.query.projectId;
    if (!projectId) {
      return res.status(400).json({ message: 'O projectId é obrigatório' });
    }
    const demandas = await Demanda.find({ project: projectId }).populate('responsaveis');
    res.status(200).json(demandas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.put('/api/demandas/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const responsavelIds = await findOrCreateResponsaveis(req.body.responsaveis);
    const demandaData = {
      demandaId: req.body.demandaId,
      nome: req.body.nome,
      tempoEstimado: req.body.tempoEstimado,
      linkDemanda: req.body.linkDemanda,
      status: req.body.status,
      responsaveis: responsavelIds
    };
    const updatedDemanda = await Demanda.findByIdAndUpdate(req.params.id, demandaData, { new: true, runValidators: true });
    if (!updatedDemanda) return res.status(404).json({ message: 'Demanda não encontrada' });
    const populatedDemanda = await Demanda.findById(updatedDemanda._id).populate('responsaveis');
    res.status(200).json(populatedDemanda);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.delete('/api/demandas/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const demandaId = req.params.id;
    const demanda = await Demanda.findById(demandaId);
    if (!demanda) {
      return res.status(404).json({ message: 'Demanda não encontrada' });
    }
    await Scenario.deleteMany({ demanda: demandaId });
    await Demanda.findByIdAndDelete(demandaId);
    res.status(200).json({ message: 'Demanda e todos os seus cenários deletados.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --- ROTAS DE CENÁRIOS ---
app.post('/api/scenarios', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const newScenario = new Scenario({
      title: req.body.title,
      description: req.body.description,
      steps: req.body.steps,
      expectedResult: req.body.expectedResult,
      demanda: req.body.demanda
    });
    const savedScenario = await newScenario.save();
    res.status(201).json(savedScenario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.get('/api/scenarios', authMiddleware, async (req, res) => {
  try {
    const demandaId = req.query.demandaId;
    if (!demandaId) {
      return res.status(400).json({ message: 'O demandaId é obrigatório' });
    }
    if (!mongoose.Types.ObjectId.isValid(demandaId)) {
      return res.status(400).json({ message: 'O demandaId é inválido' });
    }
    const demandaObjId = new mongoose.Types.ObjectId(demandaId);
    const scenarios = await Scenario.find({ demanda: demandaObjId });
    res.status(200).json(scenarios);
  } catch (error) {
    console.error('Erro na rota GET /api/scenarios:', error);
    res.status(500).json({ message: error.message });
  }
});
app.get('/api/scenarios/:id', authMiddleware, async (req, res) => {
  try {
    const scenario = await Scenario.findById(req.params.id);
    if (!scenario) return res.status(404).json({ message: 'Cenário não encontrado' });
    res.status(200).json(scenario);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.put('/api/scenarios/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const updatedScenario = await Scenario.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedScenario) return res.status(404).json({ message: 'Cenário não encontrado' });
    res.status(200).json(updatedScenario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.delete('/api/scenarios/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const deletedScenario = await Scenario.findByIdAndDelete(req.params.id);
    if (!deletedScenario) return res.status(404).json({ message: 'Cenário não encontrado' });
    res.status(200).json({ message: 'Cenário deletado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.patch('/api/scenarios/:id/status', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { status, mantisLink } = req.body;
    const scenarioId = req.params.id;
    const updateData = {
      status: status,
      mantisLink: status === 'Com Erro' ? mantisLink : ''
    };
    const updatedScenario = await Scenario.findByIdAndUpdate(
      scenarioId,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedScenario) {
      return res.status(404).json({ message: 'Cenário não encontrado' });
    }
    res.status(200).json(updatedScenario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// --- ROTA DE DASHBOARD (COM CORREÇÕES NAS AGREGAÇÕES) ---
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    // --- 1. PREPARAÇÃO DOS FILTROS ---
    const { projectId, responsavelId } = req.query;

    let projectMatch = {};
    let demandaMatch = {};
    let scenarioMatch = {};

    const pId = (projectId && mongoose.Types.ObjectId.isValid(projectId)) ? new mongoose.Types.ObjectId(projectId) : null;
    const rId = (responsavelId && mongoose.Types.ObjectId.isValid(responsavelId)) ? new mongoose.Types.ObjectId(responsavelId) : null;

    if (pId && rId) {
      projectMatch = { _id: pId, responsaveis: rId };
      demandaMatch = { project: pId, responsaveis: rId };
    } else if (pId) {
      projectMatch = { _id: pId };
      demandaMatch = { project: pId };
    } else if (rId) {
      projectMatch = { responsaveis: rId };
      demandaMatch = { responsaveis: rId };
    }

    // Este `if` é crucial e deve ficar *depois* da definição de 'demandaMatch'
    if (pId || rId) {
      // Encontra os IDs das demandas que correspondem aos filtros
      const demandaIds = (await Demanda.find(demandaMatch, '_id')).map(d => d._id);
      scenarioMatch = { demanda: { $in: demandaIds } };
    }

    // --- 2. EXECUÇÃO DAS ESTATÍSTICAS ---
    const totalProjects = await Project.countDocuments(projectMatch);
    const totalDemandas = await Demanda.countDocuments(demandaMatch);
    const totalScenarios = await Scenario.countDocuments(scenarioMatch);
    const demandasAguardandoCorrecao = await Demanda.countDocuments({ ...demandaMatch, status: 'Aguardando Correção' });
    const totalHorasAgreg = await Demanda.aggregate([
      { $match: demandaMatch },
      { $group: { _id: null, totalHoras: { $sum: '$tempoEstimado' } } }
    ]);
    const totalHorasEstimadas = totalHorasAgreg[0]?.totalHoras || 0;
    const scenariosByStatus = await Scenario.aggregate([
      { $match: scenarioMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const demandasByStatus = await Demanda.aggregate([
      { $match: demandaMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const projectsByStatus = await Project.aggregate([
      { $match: projectMatch },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const horasPorProjeto = await Demanda.aggregate([
      { $match: demandaMatch },
      {
        $group: {
          _id: '$project',
          totalHoras: { $sum: '$tempoEstimado' }
        }
      },
      { $lookup: { from: 'projects', localField: '_id', foreignField: '_id', as: 'projectData' } },
      { $unwind: { path: '$projectData', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: { $ifNull: ["$projectData.title", "Projeto Deletado"] },
          count: '$totalHoras'
        }
      },
      { $sort: { count: -1 } }
    ]);
    const bugsByTester = await Scenario.aggregate([
      { $match: { ...scenarioMatch, status: 'Com Erro' } },
      { $lookup: { from: 'demandas', localField: 'demanda', foreignField: '_id', as: 'demandaData' } },
      { $unwind: '$demandaData' },
      // Aplica o filtro de demanda (que já contém o filtro de resp., se houver)
      { $match: { "demandaData._id": { $in: (await Demanda.find(demandaMatch, '_id')).map(d => d._id) } } },
      { $unwind: '$demandaData.responsaveis' },
      { $lookup: { from: 'responsaveis', localField: 'demandaData.responsaveis', foreignField: '_id', as: 'respData' } },
      { $unwind: { path: "$respData", preserveNullAndEmptyArrays: true } },
      { $group: { _id: { $ifNull: ["$respData.name", "Desconhecido"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    const demandasMaisBugs = await Scenario.aggregate([
      { $match: { ...scenarioMatch, status: 'Com Erro' } },
      { $group: { _id: '$demanda', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'demandas', localField: '_id', foreignField: '_id', as: 'demandaData' } },
      { $unwind: '$demandaData' },
      { $project: { _id: '$demandaData.nome', demandaId: '$demandaData.demandaId', count: '$count' } }
    ]);
    const totalDemandasCobertasAgreg = await Scenario.aggregate([
      { $match: scenarioMatch },
      { $group: { _id: '$demanda' } },
      { $count: 'count' }
    ]);
    const totalDemandasCobertas = totalDemandasCobertasAgreg[0]?.count || 0;

    // --- 3. CORREÇÃO NAS AGREGAÇÕES DE RESPONSÁVEL ---

    // Esta consulta agora começa em 'Responsaveis' para garantir que 0s sejam contados
    const demandasByTester = await Responsavel.aggregate([
      { $match: (rId ? { _id: rId } : {}) }, // Filtra por responsável
      {
        $lookup: {
          from: "demandas",
          let: { respId: "$_id" },
          pipeline: [
            {
              $match: {
                ...demandaMatch, // Aplica o filtro de projeto (pId)
                $expr: { $in: ["$$respId", "$responsaveis"] }
              }
            },
            { $count: "count" }
          ],
          as: "demandasData"
        }
      },
      {
        $project: {
          _id: "$name",
          count: { $ifNull: [{ $arrayElemAt: ["$demandasData.count", 0] }, 0] }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const horasByTester = await Responsavel.aggregate([
      { $match: (rId ? { _id: rId } : {}) },
      {
        $lookup: {
          from: "demandas",
          let: { respId: "$_id" },
          pipeline: [
            {
              $match: {
                ...demandaMatch,
                $expr: { $in: ["$$respId", "$responsaveis"] }
              }
            }
          ],
          as: "demandasData"
        }
      },
      { $unwind: { path: "$demandasData", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$name",
          count: { $sum: { $ifNull: ["$demandasData.tempoEstimado", 0] } }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const testandoByTester = await Responsavel.aggregate([
      { $match: (rId ? { _id: rId } : {}) },
      {
        $lookup: {
          from: "demandas",
          let: { respId: "$_id" },
          pipeline: [
            {
              $match: {
                ...demandaMatch,
                status: 'Testando',
                $expr: { $in: ["$$respId", "$responsaveis"] }
              }
            },
            { $count: "count" }
          ],
          as: "demandasData"
        }
      },
      {
        $project: {
          _id: "$name",
          count: { $ifNull: [{ $arrayElemAt: ["$demandasData.count", 0] }, 0] }
        }
      },
      { $sort: { count: -1 } }
    ]);
    // --- FIM DAS CORREÇÕES ---

    // Formata os dados
    const formatReduce = (acc, item) => {
      if (item._id) acc[item._id] = item.count;
      return acc;
    };
    const formatMap = (item) => ({ _id: item._id, count: item.count });

    const stats = {
      totalProjects,
      totalDemandas,
      totalScenarios,
      totalHorasEstimadas,
      demandasAguardandoCorrecao,
      totalDemandasCobertas,
      scenariosByStatus: scenariosByStatus.reduce(formatReduce, {}),
      demandasByStatus: demandasByStatus.reduce(formatReduce, {}),
      projectsByStatus: projectsByStatus.reduce(formatReduce, {}),
      horasPorProjeto: horasPorProjeto.map(formatMap),
      demandasMaisBugs: demandasMaisBugs.map(item => ({ _id: item._id, demandaId: item.demandaId, count: item.count })),
      demandasByTester: demandasByTester.map(formatMap),
      horasByTester: horasByTester.map(formatMap),
      testandoByTester: testandoByTester.map(formatMap),
    };

    res.status(200).json(stats);
  } catch (error) {
    console.error("Erro na rota /api/stats:", error);
    res.status(500).json({ message: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`);
});