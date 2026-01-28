const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true, // Garante que não teremos tags duplicadas
    lowercase: true // Salva 'Mobile' e 'mobile' como 'mobile'
  }
}, { timestamps: true });

module.exports = mongoose.model('Tag', tagSchema);