const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  
  // --- CAMPO ATUALIZADO ---
  // Substituímos 'responsavel: String' por:
  responsaveis: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Responsavel'
  }],
  
  status: {
    type: String,
    enum: ['Não Iniciado', 'Em Andamento', 'Concluído', 'Interrompido'],
    default: 'Não Iniciado'
  },
  tags: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tag'
  }]

}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);