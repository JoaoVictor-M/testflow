const mongoose = require('mongoose');

const pendingEmailSchema = new mongoose.Schema({
    to: { type: String, required: true },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    type: { type: String, default: 'generic' }, // invite, reset, welcome
    status: {
        type: String,
        enum: ['pending', 'failed', 'sent'],
        default: 'pending'
    },
    attempts: { type: Number, default: 0 },
    errorLog: { type: String },
    createdAt: { type: Date, default: Date.now },
    lastAttempt: { type: Date }
});

module.exports = mongoose.model('PendingEmail', pendingEmailSchema);
