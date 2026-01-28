const mongoose = require('mongoose');

const scenarioSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  steps: {
    type: [String],
    required: true
  },
  expectedResult: {
    type: String,
    required: true,
    trim: true
  },
  
  // --- MUDANÇA CRÍTICA AQUI ---
  demanda: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Demanda',
    required: true
  },
  
  status: {
    type: String,
    enum: ['Aguardando', 'Passou', 'Com Erro'],
    default: 'Aguardando'
  },
  mantisLink: {
    type: String,
    trim: true,
    default: ''
  }
  
}, { timestamps: true });

module.exports = mongoose.model('Scenario', scenarioSchema);