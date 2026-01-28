const mongoose = require('mongoose');

const versionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        lowercase: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Version', versionSchema);
