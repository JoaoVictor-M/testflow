const mongoose = require('mongoose');

const retainedAttachmentSchema = new mongoose.Schema({
    demandaId: { type: mongoose.Schema.Types.ObjectId, default: null },
    demandaCode: { type: String, default: '' },
    demandaName: { type: String, default: '' },
    relativeDir: { type: String, default: '' },
    filename: { type: String, required: true },
    originalName: { type: String, default: '' },
    size: { type: Number, default: 0 },
    sha256: { type: String, default: '' }
}, { _id: false });

const cascadeDeletionJobSchema = new mongoose.Schema({
    targetType: {
        type: String,
        enum: ['Project', 'Demanda'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
    },
    targetLabel: {
        type: String,
        default: ''
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    phase: {
        type: String,
        enum: ['snapshot', 'deleting_scenarios', 'deleting_demandas', 'deleting_project', 'completed'],
        default: 'snapshot'
    },
    failedPhase: {
        type: String,
        default: null
    },
    errorMessage: {
        type: String,
        default: ''
    },
    attempts: {
        type: Number,
        default: 0
    },
    scope: {
        projectId: { type: mongoose.Schema.Types.ObjectId, default: null },
        demandaIds: [{ type: mongoose.Schema.Types.ObjectId }],
        demandaCount: { type: Number, default: 0 },
        scenarioCount: { type: Number, default: 0 }
    },
    retentionState: {
        type: String,
        enum: ['retained', 'approved_for_purge', 'purged'],
        default: 'retained',
        index: true
    },
    retainedAttachments: {
        type: [retainedAttachmentSchema],
        default: []
    },
    auditSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    },
    recoveredAt: {
        type: Date,
        default: null
    },
    purgedAt: {
        type: Date,
        default: null
    },
    purgeSummary: {
        removedFiles: { type: Number, default: 0 },
        skippedSharedFiles: { type: Number, default: 0 },
        missingFiles: { type: Number, default: 0 }
    }
}, { timestamps: true });

module.exports = mongoose.model('CascadeDeletionJob', cascadeDeletionJobSchema);
