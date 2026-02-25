const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Scenario = require('./models/Scenario');
const Project = require('./models/Project');
const Tag = require('./models/Tag');
const Version = require('./models/Version');
const Server = require('./models/Server');
const Responsavel = require('./models/Responsavel');
const Demanda = require('./models/Demanda');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const authMiddleware = require('./middleware/authMiddleware');
const roleMiddleware = require('./middleware/roleMiddleware');
const SystemConfig = require('./models/SystemConfig');
const { sendInviteEmail, sendResetPasswordEmail, reloadConfig } = require('./services/emailService');
// const { generatePassword } = require('./utils/passwordUtils'); // Unused
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { logAudit } = require('./services/auditService');
const AuditLog = require('./models/AuditLog');
require('dotenv').config();

const cleanAuditData = (doc) => {
  if (!doc) return doc;
  const clone = { ...doc };
  delete clone.password;
  delete clone.__v;
  delete clone.resetPasswordToken;
  delete clone.resetPasswordExpires;
  delete clone.evidences; // Optional, can save DB space
  return clone;
};

const JWT_SECRET = process.env.JWT_SECRET || 'testflow_secret_key_12345';


const app = express();
const PORT = 3000;
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

const MONGO_URI = 'mongodb://mongodb-service:27017/testflow-db';
mongoose.connect(MONGO_URI)
  .then(() => console.log('Conexão com o MongoDB (via Docker) estabelecida!')) // eslint-disable-line no-console
  .catch((error) => console.error('!!!!!! ERRO AO CONECTAR NO MONGO !!!!!!:', error)); // eslint-disable-line no-console



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

const findOrCreateVersions = async (versionNames) => {
  if (!versionNames || versionNames.length === 0) return [];
  const uniqueNames = [...new Set(versionNames.map(name => name.trim().toLowerCase()))];
  const promises = uniqueNames.map(async (name) => {
    const existing = await Version.findOne({ name: name });
    if (existing) return existing._id;
    const novo = new Version({ name: name });
    const saved = await novo.save();
    return saved._id;
  });
  return Promise.all(promises);
};

const findOrCreateServers = async (serverNames) => {
  if (!serverNames || serverNames.length === 0) return [];
  const uniqueNames = [...new Set(serverNames.map(name => name.trim().toLowerCase()))];
  const promises = uniqueNames.map(async (name) => {
    const existing = await Server.findOne({ name: name });
    if (existing) return existing._id;
    const novo = new Server({ name: name });
    const saved = await novo.save();
    return saved._id;
  });
  return Promise.all(promises);
};





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

    const payload = {
      userId: user._id,
      username: user.username,
      name: user.name, // Add name to token
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({ token, user: { username: user.username, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { username, email } = req.body;
    const user = await User.findOne({ username, email });

    // Verificação explícita solicitada pelo usuário
    if (!user) {
      return res.status(400).json({ message: 'Usuário ou email incorretos.' });
    }

    // Generate token
    const token = crypto.randomBytes(20).toString('hex');

    // Hash token to save in DB
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    // Send email with unhashed token
    // In production, this should be the frontend URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost/testflow';
    const resetLink = `${frontendUrl}/reset-password/${token}`;

    sendResetPasswordEmail(email, user.name, resetLink)
      .catch(err => console.error("Erro ao enviar email de reset:", err)); // eslint-disable-line no-console

    res.status(200).json({ message: 'Se os dados estiverem corretos, um email de recuperação será enviado.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/auth/validate-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Hash token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token inválido ou expirado' });
    }

    // Return partial user info (safe)
    res.status(200).json({
      valid: true,
      name: user.name,
      username: user.username
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Hash token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token inválido ou expirado' });
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post('/auth/register', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const { username, email, role, name } = req.body;

    if (!username || !email || !name) {
      return res.status(400).json({ message: 'Nome, Username e Email são obrigatórios.' });
    }


    // QA Restriction: Cannot create Admin
    if (req.user.role === 'qa' && role === 'admin') {
      return res.status(403).json({ message: 'QAs não têm permissão para criar Administradores.' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Este endereço de email já está cadastrado.' });
    }

    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({ message: 'Este nome de usuário já existe.' });
    }

    // Generate token for account setup
    const token = crypto.randomBytes(20).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Create user with random password (secure placeholder) and setup tokens
    const randomPassword = crypto.randomBytes(32).toString('hex');

    const newUser = new User({
      name,
      username,
      email,
      password: randomPassword, // Will be hashed by model
      role: role || 'viewer',
      resetPasswordToken: hashedToken,
      resetPasswordExpires: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year (pseudo "no expire")
    });

    const savedUser = await newUser.save();

    // Log the full user object (cleaned)
    const newLean = await User.findById(savedUser._id).lean();
    await logAudit('CREATE', 'User', savedUser._id, req.user.userId, { new: cleanAuditData(newLean) });

    // Generate Link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
    const setupLink = `${frontendUrl}/reset-password/${token}`;

    // Send email (failed email should not rollback user creation, but log error)
    sendInviteEmail(email, username, name, setupLink)
      .catch(err => console.error("Falha a enviar email de convite:", err)); // eslint-disable-line no-console

    res.status(201).json({
      message: 'Usuário criado com sucesso. Link de definição de senha enviado por email.',
      user: { _id: newUser._id, username: newUser.username, name: newUser.name, role: newUser.role, email: newUser.email }
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.post('/api/users/generate-username', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.json({ username: '' });
    }

    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return res.json({ username: '' });

    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : '';

    const normalize = (str) => {
      return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") : "";
    };

    let baseUsername = normalize(first);
    if (last) {
      baseUsername += `.${normalize(last)}`;
    }

    let username = baseUsername;
    let counter = 1;

    // Loop until unique
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    res.json({ username });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/users', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const users = await User.find({ username: { $ne: 'admin' } }, '-password').sort({ username: 1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const { username, password, role, name } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    const oldUser = await User.findById(userId).lean();

    // QA Restriction: Cannot edit Admin
    if (req.user.role === 'qa' && user.role === 'admin') {
      return res.status(403).json({ message: 'QAs não podem editar Administradores.' });
    }

    // QA Restriction: Cannot promote to Admin
    if (req.user.role === 'qa' && role === 'admin') {
      return res.status(403).json({ message: 'QAs não podem promover usuários a Administrador.' });
    }

    if (name) user.name = name;
    if (username) user.username = username;
    if (role) user.role = role;
    if (password && password.trim() !== '') {
      user.password = password;
    }

    await user.save();

    const newLean = await User.findById(user._id).lean();
    let summary = `Perfil do usuário modificado.`;
    if (password && password.trim() !== '') {
      summary = `Senha do usuário redefinida.`;
    }

    await logAudit('UPDATE', 'User', user._id, req.user.userId, { old: cleanAuditData(oldUser), new: cleanAuditData(newLean), summary });
    res.status(200).json({ message: 'Usuário atualizado com sucesso', user: { _id: user._id, username: user.username, name: user.name, role: user.role, email: user.email } });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const userId = req.params.id;
    if (req.user.userId === userId) {
      return res.status(400).json({ message: 'Você não pode deletar a si mesmo.' });
    }

    const user = await User.findByIdAndDelete(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    await logAudit('DELETE', 'User', userId, req.user.userId, { old: cleanAuditData(user) });
    res.status(200).json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/import', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  const { users } = req.body; // Array of { name, email, role }
  console.log(`[DEBUG] Received import request for ${users ? users.length : 0} users.`); // eslint-disable-line no-console

  if (!users || !Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ message: 'Nenhum usuário para importar.' });
  }

  const results = {
    success: 0,
    failed: 0,
    details: []
  };

  for (const userData of users) {
    // Validate role
    if (userData.role === 'admin') {
      results.failed++;
      results.details.push({ ...userData, error: 'Criação de admin não permitida via importação.' });
      continue;
    }

    // QA Restriction: Cannot import admins (redundant check but safe)
    if (req.user.role === 'qa' && userData.role === 'admin') {
      results.failed++;
      results.details.push({ ...userData, error: 'QAs não podem importar Admins.' });
      continue;
    }

    // Basic validation
    if (!userData.name || !userData.email) {
      results.failed++;
      results.details.push({ ...userData, error: 'Nome ou Email ausente.' });
      continue;
    }

    try {
      // Check if email already exists
      const existingEmail = await User.findOne({ email: userData.email });
      if (existingEmail) {
        throw new Error('Email já cadastrado.');
      }

      // Generate Unique Username
      const normalize = (str) => {
        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "") : "";
      };

      const parts = userData.name.trim().split(/\s+/);
      const first = parts[0];
      const last = parts.length > 1 ? parts[parts.length - 1] : '';

      let baseUsername = normalize(first);
      if (last) {
        baseUsername += `.${normalize(last)}`;
      }

      let username = baseUsername;
      let counter = 1;

      // Loop until unique
      while (await User.findOne({ username })) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      // Logic same as Register
      const token = crypto.randomBytes(20).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      const randomPassword = crypto.randomBytes(32).toString('hex');

      const newUser = new User({
        name: userData.name,
        username: username,
        email: userData.email,
        password: randomPassword,
        role: userData.role || 'viewer',
        resetPasswordToken: hashedToken,
        resetPasswordExpires: Date.now() + (365 * 24 * 60 * 60 * 1000)
      });

      const savedUser = await newUser.save();

      const newLean = await User.findById(savedUser._id).lean();
      await logAudit('CREATE', 'User', savedUser._id, req.user.userId, { new: cleanAuditData(newLean) });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost';
      const setupLink = `${frontendUrl}/reset-password/${token}`;

      // Use the queue-enabled send function
      console.log(`[DEBUG] Sending invite email to ${userData.email} (User: ${username}, Name: ${userData.name})...`); // eslint-disable-line no-console
      sendInviteEmail(userData.email, username, userData.name, setupLink)
        .catch(err => console.error(`Falha ao enviar convite para ${userData.email}:`, err)); // eslint-disable-line no-console

      results.success++;
    } catch (err) {
      results.failed++;
      results.details.push({ ...userData, error: err.message });
    }
  }

  res.json({
    message: `Processamento concluído. Sucesso: ${results.success}, Falhas: ${results.failed}`,
    results
  });
});



app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({}).populate('tags').populate('responsaveis').populate('versions').populate('servers');
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/projects', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const tagIds = await findOrCreateTags(req.body.tags);
    const responsavelIds = await findOrCreateResponsaveis(req.body.responsaveis);
    const versionIds = await findOrCreateVersions(req.body.versions);
    const serverIds = await findOrCreateServers(req.body.servers);

    const newProject = new Project({
      title: req.body.title,
      status: req.body.status,
      tags: tagIds,
      responsaveis: responsavelIds,
      versions: versionIds,
      servers: serverIds
    });
    const savedProject = await newProject.save();
    const newLean = await Project.findById(savedProject._id).lean();
    let summary = null;
    if (req.body.sourceId) {
      const originalProject = await Project.findById(req.body.sourceId);
      summary = `Duplicado a partir do projeto: ${originalProject ? originalProject.title : req.body.sourceId}`;
    }
    await logAudit('CREATE', 'Project', savedProject._id, req.user.userId, { new: cleanAuditData(newLean), summary });

    // DEEP CLONE LOGIC
    if (req.body.sourceId) {
      const sourceId = req.body.sourceId;
      console.log(`[CLONE] Duplicando demandas do projeto ${sourceId} para ${savedProject._id}`); // eslint-disable-line no-console

      const demandas = await Demanda.find({ project: sourceId });
      for (const dem of demandas) {
        // const responsavelIdsDemanda = await findOrCreateResponsaveis(dem.responsaveis.map(r => r.name)); // Unused and potentially incorrect

        // Check if we need to ensure uniqueness or just copy
        // For simplicity, we copy. Frontend logic added " (Cópia)" to Project title only.
        // We usually want exact copies of children unless uniqueness is enforced by DB index.
        // DemandaId might be unique?
        // Let's assume typical flow: user clones project, we copy everything.

        const newDem = new Demanda({
          demandaId: dem.demandaId, // Use original or maybe append COPY? Let's keep original for now unless it errors.
          nome: dem.nome,
          tempoEstimado: dem.tempoEstimado,
          linkDemanda: dem.linkDemanda,
          status: dem.status, // Copy status? Yes.
          project: savedProject._id,
          responsaveis: dem.responsaveis // Assuming IDs are compatible or we need to re-fetch/map. 
          // Wait, findOrCreateResponsaveis expects names. 
          // 'dem.responsaveis' in find result is Array of ObjectIds if not populated, or Objects if populated.
          // The previous query `Demanda.find({})` does NOT autopopulate unless we say so.
          // Let's check `Demanda` schema usage. Ideally we just copy the array of IDs.
        });

        // Correct way to copy array of ObjectIds:
        newDem.responsaveis = dem.responsaveis;

        const savedDem = await newDem.save();

        // Clone Scenarios
        const scenarios = await Scenario.find({ demanda: dem._id });
        for (const scen of scenarios) {
          const newScen = new Scenario({
            title: scen.title,
            description: scen.description,
            steps: scen.steps,
            expectedResult: scen.expectedResult,
            demanda: savedDem._id,
            status: scen.status,
            mantisLink: scen.mantisLink
          });
          await newScen.save();
        }
      }
    }

    const populatedProject = await Project.findById(savedProject._id)
      .populate('tags')
      .populate('responsaveis')
      .populate('versions')
      .populate('servers');
    res.status(201).json(populatedProject);
  } catch (error) {
    console.error(error); // eslint-disable-line no-console
    res.status(400).json({ message: error.message });
  }
});

app.put('/api/projects/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const tagIds = await findOrCreateTags(req.body.tags);
    const responsavelIds = await findOrCreateResponsaveis(req.body.responsaveis);
    const versionIds = await findOrCreateVersions(req.body.versions);
    const serverIds = await findOrCreateServers(req.body.servers);

    const projectData = {
      title: req.body.title,
      status: req.body.status,
      tags: tagIds,
      responsaveis: responsavelIds,
      versions: versionIds,
      servers: serverIds
    };
    const oldProject = await Project.findById(req.params.id).lean();
    const updatedProject = await Project.findByIdAndUpdate(req.params.id, projectData, { new: true, runValidators: true }).lean();
    if (!updatedProject) return res.status(404).json({ message: 'Projeto não encontrado' });
    await logAudit('UPDATE', 'Project', updatedProject._id, req.user.userId, { old: cleanAuditData(oldProject), new: cleanAuditData(updatedProject) });
    const populatedProject = await Project.findById(updatedProject._id)
      .populate('tags')
      .populate('responsaveis')
      .populate('versions')
      .populate('servers');
    res.status(200).json(populatedProject);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete('/api/projects/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
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
    const deletedProject = await Project.findByIdAndDelete(projectId).lean();
    await logAudit('DELETE', 'Project', projectId, req.user.userId, { old: cleanAuditData(deletedProject) });
    res.status(200).json({ message: 'Projeto e todos os seus dados (demandas e cenários) deletados.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/tags', async (req, res) => {
  try {
    const tags = await Tag.find({}).sort({ name: 1 });
    res.status(200).json(tags);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.delete('/api/tags/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const tagId = req.params.id;
    const deletedTag = await Tag.findByIdAndDelete(tagId).lean();
    await Project.updateMany(
      { tags: tagId },
      { $pull: { tags: tagId } }
    );
    if (deletedTag && req.user && req.user.userId) {
      await logAudit('DELETE', 'Tag', tagId, req.user.userId, { old: cleanAuditData(deletedTag), summary: `Tag "${deletedTag.name}" excluída.` });
    }
    res.status(200).json({ message: 'Tag deletada e removida dos projetos.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/responsaveis', authMiddleware, async (req, res) => {
  try {
    const responsaveis = await Responsavel.find({}).sort({ name: 1 });
    res.status(200).json(responsaveis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/versions', async (req, res) => {
  try {
    const items = await Version.find({}).sort({ name: 1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/servers', async (req, res) => {
  try {
    const items = await Server.find({}).sort({ name: 1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/system/version', async (req, res) => {
  try {
    const packageJson = require('./package.json');
    res.json({ version: packageJson.version });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post('/api/demandas', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
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
    const newLean = await Demanda.findById(savedDemanda._id).lean();
    let summary = null;
    if (req.body.sourceId) {
      const originalDemanda = await Demanda.findById(req.body.sourceId);
      summary = `Duplicado a partir da demanda: ${originalDemanda ? originalDemanda.nome : req.body.sourceId}`;
    }
    await logAudit('CREATE', 'Demanda', savedDemanda._id, req.user.userId, { new: cleanAuditData(newLean), summary });

    // DEEP CLONE LOGIC
    if (req.body.sourceId) {
      const sourceId = req.body.sourceId;
      console.log(`[CLONE] Duplicando cenários da demanda ${sourceId} para ${savedDemanda._id}`); // eslint-disable-line no-console
      const scenarios = await Scenario.find({ demanda: sourceId });
      for (const scen of scenarios) {
        const newScen = new Scenario({
          title: scen.title,
          description: scen.description,
          steps: scen.steps,
          expectedResult: scen.expectedResult,
          demanda: savedDemanda._id,
          status: scen.status,
          mantisLink: scen.mantisLink
        });
        await newScen.save();
      }
    }

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
app.put('/api/demandas/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
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
    const oldDemanda = await Demanda.findById(req.params.id).lean();
    const updatedDemanda = await Demanda.findByIdAndUpdate(req.params.id, demandaData, { new: true, runValidators: true }).lean();
    if (!updatedDemanda) return res.status(404).json({ message: 'Demanda não encontrada' });
    await logAudit('UPDATE', 'Demanda', updatedDemanda._id, req.user.userId, { old: cleanAuditData(oldDemanda), new: cleanAuditData(updatedDemanda) });
    const populatedDemanda = await Demanda.findById(updatedDemanda._id).populate('responsaveis');
    res.status(200).json(populatedDemanda);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.delete('/api/demandas/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const demandaId = req.params.id;
    const demanda = await Demanda.findById(demandaId);
    if (!demanda) {
      return res.status(404).json({ message: 'Demanda não encontrada' });
    }
    await Scenario.deleteMany({ demanda: demandaId });
    const deletedDemanda = await Demanda.findByIdAndDelete(demandaId).lean();
    await logAudit('DELETE', 'Demanda', demandaId, req.user.userId, { old: cleanAuditData(deletedDemanda) });
    res.status(200).json({ message: 'Demanda e todos os seus cenários deletados.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.post('/api/scenarios', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const newScenario = new Scenario({
      title: req.body.title,
      description: req.body.description,
      steps: req.body.steps,
      expectedResult: req.body.expectedResult,
      demanda: req.body.demanda
    });
    const savedScenario = await newScenario.save();
    const newLean = await Scenario.findById(savedScenario._id).lean();
    let summary = null;
    if (req.body.sourceId) {
      const originalScenario = await Scenario.findById(req.body.sourceId);
      summary = `Duplicado a partir do cenário: ${originalScenario ? originalScenario.title : req.body.sourceId}`;
    }
    await logAudit('CREATE', 'Scenario', savedScenario._id, req.user.userId, { new: cleanAuditData(newLean), summary });
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
    console.error('Erro na rota GET /api/scenarios:', error); // eslint-disable-line no-console
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
app.put('/api/scenarios/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const oldScenario = await Scenario.findById(req.params.id).lean();
    const updatedScenario = await Scenario.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).lean();
    if (!updatedScenario) return res.status(404).json({ message: 'Cenário não encontrado' });
    await logAudit('UPDATE', 'Scenario', updatedScenario._id, req.user.userId, { old: cleanAuditData(oldScenario), new: cleanAuditData(updatedScenario) });
    res.status(200).json(updatedScenario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
app.delete('/api/scenarios/:id', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const deletedScenario = await Scenario.findByIdAndDelete(req.params.id).lean();
    if (!deletedScenario) return res.status(404).json({ message: 'Cenário não encontrado' });
    await logAudit('DELETE', 'Scenario', deletedScenario._id, req.user.userId, { old: cleanAuditData(deletedScenario) });
    res.status(200).json({ message: 'Cenário deletado' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.patch('/api/scenarios/:id/status', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const { status, mantisLink } = req.body;
    const scenarioId = req.params.id;
    const updateData = {
      status: status,
      mantisLink: status === 'Com Erro' ? mantisLink : ''
    };
    const oldScenario = await Scenario.findById(scenarioId).lean();
    const updatedScenario = await Scenario.findByIdAndUpdate(
      scenarioId,
      updateData,
      { new: true, runValidators: true }
    ).lean();
    if (!updatedScenario) {
      return res.status(404).json({ message: 'Cenário não encontrado' });
    }
    await logAudit('UPDATE', 'Scenario', updatedScenario._id, req.user.userId, { old: cleanAuditData(oldScenario), new: cleanAuditData(updatedScenario) });
    res.status(200).json(updatedScenario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
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

    if (pId || rId) {
      const demandaIds = (await Demanda.find(demandaMatch, '_id')).map(d => d._id);
      scenarioMatch = { demanda: { $in: demandaIds } };
    }

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
    // Unused aggregation bugsByTester removed
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

    const demandasByTester = await Responsavel.aggregate([
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
    console.error("Erro na rota /api/stats:", error); // eslint-disable-line no-console
    res.status(500).json({ message: error.message });
  }
});


app.get('/api/config/email', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const config = await SystemConfig.findOne({ key: 'email_settings' });
    let value = config ? config.value : {};

    // Mask password
    if (value.pass) {
      value.pass = '********';
    }

    // If no config in DB, return env vars (masked)
    if (!config) {
      value = {
        host: process.env.SMTP_HOST || '',
        port: process.env.SMTP_PORT || '',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS ? '********' : '',
        secure: process.env.SMTP_SECURE === 'true',
        from: process.env.EMAIL_FROM || ''
      };
    }

    res.json(value);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/config/email', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { host, port, user, pass, secure, from } = req.body;

    // Prepare object to save
    let newSettings = { host, port, user, secure, from };
    const existing = await SystemConfig.findOne({ key: 'email_settings' });

    // Check if password is being updated
    if (pass && pass !== '********') {
      newSettings.pass = pass;
    } else {
      // Retain existing password if available
      if (existing && existing.value.pass) {
        newSettings.pass = existing.value.pass;
      } else {
        newSettings.pass = process.env.SMTP_PASS;
      }
    }

    const updatedConfig = await SystemConfig.findOneAndUpdate(
      { key: 'email_settings' },
      { value: newSettings, updatedAt: Date.now() },
      { upsert: true, new: true }
    );

    const oldLog = existing ? { ...existing.value, pass: '********' } : {};
    const newLog = { ...newSettings, pass: '********' };
    await logAudit('UPDATE', 'SystemConfig', updatedConfig._id, req.user.userId, { old: oldLog, new: newLog });

    if (reloadConfig) reloadConfig();

    res.json({ message: 'Configurações de email atualizadas com sucesso.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// --- EVIDENCE ROUTES (ADAPTED FOR DEMANDAS) ---

// Helper para encontrar pasta da demanda
// Nota: A lógica de busca exata agora depende dos dados da demanda (ID e Nome)
// Por isso, este helper agora apenas retorna o caminho BASE ou tenta um match simples.
// A lógica robusta de verificação será movida para dentro das rotas que possuem o objeto Demanda.
const getBaseEvidenceDir = () => {
  const baseDir = path.join(__dirname, '..', 'evidencias_testes');
  if (!fs.existsSync(baseDir)) {
    try { fs.mkdirSync(baseDir, { recursive: true }); } catch (e) { console.error(e); return null; } // eslint-disable-line no-console, security/detect-non-literal-fs-filename
  }
  return baseDir;
};

// Helper legado para compatibilidade ou buscas simples por string
const findLegacyDir = (searchStr) => {
  const baseDir = getBaseEvidenceDir();
  if (!baseDir) return null;
  const dirs = fs.readdirSync(baseDir); // eslint-disable-line security/detect-non-literal-fs-filename
  return dirs.find(dir => dir.includes(searchStr));
};

// Configuração do Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Tenta usar nome enviado via header para criar pasta mais amigável
    let folderName = req.params.id; // Default: apenas ID (Mongo)

    // Updated naming convention: FriendlyID_DemandaName (e.g. WEB-123_BugNoLogin)

    const friendlyId = req.headers['x-demanda-id'];
    const friendlyName = req.headers['x-demanda-nome'];

    if (friendlyId && friendlyName) {
      const safeId = friendlyId.replace(/[^a-z0-9-]/gi, '_');
      const safeName = friendlyName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase();

      folderName = `${safeId}_${safeName}`;
    } else {
      // Fallback to params ID if headers missing
      folderName = req.params.id;
    }

    // Se já existe uma pasta com este ID (mesmo que com outro nome base), devemos usar a existente?
    // Usamos findLegacyDir para procurar qualquer pasta que contenha o MongoID
    let dir;
    const existingFolderName = findLegacyDir(req.params.id);

    if (existingFolderName) {
      dir = path.join(getBaseEvidenceDir(), existingFolderName);
    } else {
      dir = path.join(getBaseEvidenceDir(), folderName);
    }

    if (!fs.existsSync(dir)) { // eslint-disable-line security/detect-non-literal-fs-filename
      fs.mkdirSync(dir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Fix encoding: UTF-8 bytes viewed as Latin-1 -> Restore UTF-8
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});


// Upload Evidence
app.post('/api/demandas/:id/evidence', authMiddleware, roleMiddleware(['admin', 'qa']), upload.single('file'), async (req, res) => {
  try {
    const demandaId = req.params.id; // Now Demanda ID
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Nenhum arquivo enviado.' });
    }

    const demanda = await Demanda.findById(demandaId);
    if (!demanda) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); // eslint-disable-line security/detect-non-literal-fs-filename
      return res.status(404).json({ message: 'Demanda não encontrada.' });
    }

    const newEvidence = {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    };

    demanda.evidences.push(newEvidence);
    await demanda.save();

    const populatedDemanda = await Demanda.findById(demanda._id).populate('responsaveis');
    res.status(201).json(populatedDemanda);
  } catch (error) {
    console.error('Erro no upload:', error); // eslint-disable-line no-console
    res.status(500).json({ message: error.message });
  }
});


// Delete Evidence
app.delete('/api/demandas/:id/evidence/:evidenceId', authMiddleware, roleMiddleware(['admin', 'qa']), async (req, res) => {
  try {
    const { id, evidenceId } = req.params;

    const demanda = await Demanda.findById(id);
    if (!demanda) {
      return res.status(404).json({ message: 'Demanda não encontrada.' });
    }

    const evidence = demanda.evidences.id(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidência não encontrada.' });
    }

    // Resolve directory dynamically
    const baseDir = getBaseEvidenceDir();
    let dirPath = null;

    if (baseDir) {
      // Pattern 1: FriendlyID_Name (New)
      if (demanda.demandaId && demanda.nome) {
        const safeId = demanda.demandaId.replace(/[^a-z0-9-]/gi, '_');
        const safeName = demanda.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
        const tryPath = path.join(baseDir, `${safeId}_${safeName}`);
        if (fs.existsSync(tryPath)) dirPath = tryPath;
      }

      // Pattern 2: FriendlyID_MongoID (Previous Attempt)
      if (!dirPath && demanda.demandaId) {
        const safeId = demanda.demandaId.replace(/[^a-z0-9-]/gi, '_');
        const tryPath = path.join(baseDir, `${safeId}_${id}`);
        if (fs.existsSync(tryPath)) dirPath = tryPath; // eslint-disable-line security/detect-non-literal-fs-filename
      }

      // Pattern 3: MongoID or Suffix (Legacy/Fallback)
      if (!dirPath) {
        const dirs = fs.readdirSync(baseDir);
        const targetDir = dirs.find(dir => dir === id || dir.endsWith(`_${id}`));
        if (targetDir) dirPath = path.join(baseDir, targetDir);
      }
    }

    if (dirPath) {
      const filePath = path.join(dirPath, evidence.filename);
      if (fs.existsSync(filePath)) { // eslint-disable-line security/detect-non-literal-fs-filename
        fs.unlinkSync(filePath); // eslint-disable-line security/detect-non-literal-fs-filename
      }
    }

    // Remove from DB
    demanda.evidences.pull(evidenceId);

    // [New] Check if evidences are empty and status is 'Testado' -> Revert to 'Pendente'
    if (demanda.evidences.length === 0 && demanda.status === 'Testado') {
      demanda.status = 'Pendente';
    }

    await demanda.save();

    const populatedDemanda = await Demanda.findById(demanda._id).populate('responsaveis');
    res.status(200).json(populatedDemanda);
  } catch (error) {
    console.error(error); // eslint-disable-line no-console
    res.status(500).json({ message: error.message });
  }
});

// Serve Evidence File
app.get('/api/demandas/:id/evidence/:evidenceId/file', async (req, res) => {
  try {
    const { id, evidenceId } = req.params;

    const demanda = await Demanda.findById(id);
    if (!demanda) {
      return res.status(404).json({ message: 'Demanda não encontrada.' });
    }

    const evidence = demanda.evidences.id(evidenceId);
    if (!evidence) {
      return res.status(404).json({ message: 'Evidência não encontrada.' });
    }

    // Resolve directory dynamically
    const baseDir = getBaseEvidenceDir();
    let dirPath = null;

    if (baseDir) {
      // Pattern 1: FriendlyID_Name (New)
      if (demanda.demandaId && demanda.nome) {
        const safeId = demanda.demandaId.replace(/[^a-z0-9-]/gi, '_');
        const safeName = demanda.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').toLowerCase();
        const tryPath = path.join(baseDir, `${safeId}_${safeName}`);
        if (fs.existsSync(tryPath)) dirPath = tryPath; // eslint-disable-line security/detect-non-literal-fs-filename
      }

      // Pattern 2: FriendlyID_MongoID (Previous Attempt)
      if (!dirPath && demanda.demandaId) {
        const safeId = demanda.demandaId.replace(/[^a-z0-9-]/gi, '_');
        const tryPath = path.join(baseDir, `${safeId}_${id}`);
        if (fs.existsSync(tryPath)) dirPath = tryPath; // eslint-disable-line security/detect-non-literal-fs-filename
      }

      // Pattern 3: MongoID or Suffix (Legacy/Fallback)
      if (!dirPath) {
        const dirs = fs.readdirSync(baseDir);
        const targetDir = dirs.find(dir => dir === id || dir.endsWith(`_${id}`));
        if (targetDir) dirPath = path.join(baseDir, targetDir);
      }
    }

    if (!dirPath) {
      return res.status(404).json({ message: 'Pasta de evidências não encontrada.' });
    }

    const filePath = path.join(dirPath, evidence.filename);

    if (fs.existsSync(filePath)) { // eslint-disable-line security/detect-non-literal-fs-filename
      res.setHeader('Content-Type', evidence.mimetype);
      res.setHeader('Content-Disposition', `inline; filename="${evidence.originalName}"`);
      fs.createReadStream(filePath).pipe(res); // eslint-disable-line security/detect-non-literal-fs-filename
    } else {
      res.status(404).json({ message: 'Arquivo não encontrado no servidor.' });
    }
  } catch (error) {
    console.error(error); // eslint-disable-line no-console
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/audit', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.menu) query.entity = req.query.menu; // Support the new 'menu' param

    // Handle User filter
    if (req.query.user) {
      // We need to find users matching the name/username first
      const users = await User.find({
        $or: [
          { name: { $regex: req.query.user, $options: 'i' } },
          { username: { $regex: req.query.user, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);
      query.user = { $in: userIds };
    }

    // Handle Date & Time filter
    if (req.query.startDate || req.query.endDate || req.query.startTime || req.query.endTime) {
      query.createdAt = {};

      let hasStart = false;
      let hasEnd = false;

      // Start Boundary
      if (req.query.startDate || req.query.startTime) {
        let startBound = req.query.startDate ? new Date(`${req.query.startDate}T00:00:00.000`) : new Date();
        if (!req.query.startDate) startBound.setHours(0, 0, 0, 0); // fallback to today

        if (req.query.startTime) {
          const [hours, minutes] = req.query.startTime.split(':');
          startBound.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        }

        query.createdAt.$gte = startBound;
        hasStart = true;
      }

      // End Boundary
      if (req.query.endDate || req.query.endTime) {
        let endBound = req.query.endDate ? new Date(`${req.query.endDate}T00:00:00.000`) : new Date();
        if (!req.query.endDate) endBound.setHours(23, 59, 59, 999);

        if (req.query.endTime) {
          const [hours, minutes] = req.query.endTime.split(':');
          endBound.setHours(parseInt(hours, 10), parseInt(minutes, 10), 59, 999);
        } else if (req.query.endDate) {
          endBound.setHours(23, 59, 59, 999);
        }

        query.createdAt.$lte = endBound;
        hasEnd = true;
      }

      if (!hasStart && !hasEnd) delete query.createdAt;
    }

    // Sort options
    let sortOptions = { createdAt: -1 }; // Default
    if (req.query.sortBy) {
      const order = req.query.order === 'asc' ? 1 : -1;
      if (req.query.sortBy === 'date') {
        sortOptions = { createdAt: order };
      } else if (req.query.sortBy === 'action') {
        sortOptions = { action: order, createdAt: -1 };
      } else if (req.query.sortBy === 'menu') {
        sortOptions = { entity: order, createdAt: -1 };
      }
      // User sorting is tricky natively because it's a ref. We can handle basic sorting or fallback to Date
    }

    const total = await AuditLog.countDocuments(query);
    let logs = await AuditLog.find(query)
      .populate('user', 'name username')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();

    // Post-query sorting for users if requested (since it requires populated data)
    if (req.query.sortBy === 'user') {
      const order = req.query.order === 'asc' ? 1 : -1;
      logs.sort((a, b) => {
        const nameA = (a.user?.name || '').toLowerCase();
        const nameB = (b.user?.name || '').toLowerCase();
        if (nameA < nameB) return -1 * order;
        if (nameA > nameB) return 1 * order;
        return 0;
      });
      // Re-apply pagination manually if we sort by reference (this is imperfect for large sets, 
      // but acceptable for generic logs unless we use Aggregation Pipeline)
      // Since we didn't use Aggregation Pipeline, the pagination is slightly skewed if sorted by user.
      // For a more robust solution, we use aggregation.
    }

    res.status(200).json({
      data: logs,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando na porta ${PORT}`); // eslint-disable-line no-console
});
