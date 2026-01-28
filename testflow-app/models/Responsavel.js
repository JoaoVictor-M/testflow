const mongoose = require('mongoose');

const responsavelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true, // Garante que não teremos nomes duplicados
    lowercase: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Responsavel', responsavelSchema);