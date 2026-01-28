const mongoose = require('mongoose');

const serverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Server', serverSchema);
