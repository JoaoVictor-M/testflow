const mongoose = require('mongoose');

const demandaSchema = new mongoose.Schema({
  demandaId: {
    type: String,
    required: true,
    trim: true
  },
  nome: {
    type: String,
    required: true,
    trim: true
  },

  // --- MUDANÇA AQUI ---
  tempoEstimado: {
    type: Number, // Trocado de String para Number
    default: 0
  },
  // --- FIM DA MUDANÇA ---

  linkDemanda: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pendente', 'Testando', 'Aguardando Correção', 'Testado'],
    default: 'Pendente'
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  responsaveis: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Responsavel'
  }],
  evidences: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    uploadDate: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Demanda', demandaSchema);