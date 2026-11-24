const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const AuditLog = require('../models/AuditLog');
const CascadeDeletionJob = require('../models/CascadeDeletionJob');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');
const { logAudit } = require('./auditService');
const {
    candidateEvidenceDirsForDemanda,
    resolveEvidenceFile,
    resolveEvidenceSubdir
} = require('../utils/evidencePath');
const { logger } = require('../utils/logger');

const DEFAULT_EVIDENCE_BASE_DIR = path.resolve(__dirname, '..', '..', 'evidencias_testes');

const cleanAuditSnapshot = (doc) => {
    if (!doc) return doc;
    const clone = { ...doc };
    delete clone.password;
    delete clone.__v;
    delete clone.resetPasswordToken;
    delete clone.resetPasswordExpires;
    delete clone.evidences;
    return clone;
};

const sha256IfRegularFile = (filePath) => {
    if (!filePath || !fs.existsSync(filePath)) return ''; // eslint-disable-line security/detect-non-literal-fs-filename
    const stat = fs.lstatSync(filePath); // eslint-disable-line security/detect-non-literal-fs-filename
    if (!stat.isFile()) return '';
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); // eslint-disable-line security/detect-non-literal-fs-filename
};

const resolveDemandaEvidenceEntry = (demanda, evidence, evidenceBaseDir) => {
    const candidates = candidateEvidenceDirsForDemanda(demanda);
    let chosenDir = candidates[0] || '';
    let sha256 = '';

    for (const relativeDir of candidates) {
        const subdir = resolveEvidenceSubdir(evidenceBaseDir, relativeDir);
        const filePath = subdir && resolveEvidenceFile(subdir, evidence.filename);
        if (filePath && fs.existsSync(filePath)) { // eslint-disable-line security/detect-non-literal-fs-filename
            chosenDir = relativeDir;
            sha256 = sha256IfRegularFile(filePath);
            break;
        }
    }

    return {
        demandaId: demanda._id,
        demandaCode: demanda.demandaId || '',
        demandaName: demanda.nome || '',
        relativeDir: chosenDir,
        filename: evidence.filename,
        originalName: evidence.originalName || '',
        size: typeof evidence.size === 'number' ? evidence.size : 0,
        sha256
    };
};

const snapshotDemandaAttachments = (demandas, evidenceBaseDir) => {
    const items = [];
    for (const demanda of demandas) {
        const evidences = Array.isArray(demanda.evidences) ? demanda.evidences : [];
        for (const evidence of evidences) {
            if (!evidence || typeof evidence.filename !== 'string' || !evidence.filename) continue;
            items.push(resolveDemandaEvidenceEntry(demanda, evidence, evidenceBaseDir));
        }
    }
    return items;
};

const runCascadePhases = async (job, { userId, isRecovery = false }) => {
    let currentPhase = 'deleting_scenarios';
    const actorId = userId || job.requestedBy;

    try {
        job.status = 'in_progress';
        job.attempts = (job.attempts || 0) + 1;
        job.failedPhase = null;
        job.errorMessage = '';
        job.phase = currentPhase;
        await job.save();

        const demandaIds = job.scope?.demandaIds || [];
        if (demandaIds.length > 0) {
            await Scenario.deleteMany({ demanda: { $in: demandaIds } });
        }

        currentPhase = 'deleting_demandas';
        job.phase = currentPhase;
        await job.save();

        if (job.targetType === 'Project') {
            await Demanda.deleteMany({ project: job.targetId });
        } else if (demandaIds.length > 0) {
            await Demanda.deleteMany({ _id: { $in: demandaIds } });
        }

        if (job.targetType === 'Project') {
            currentPhase = 'deleting_project';
            job.phase = currentPhase;
            await job.save();
            await Project.findByIdAndDelete(job.targetId);
        }

        const alreadyAudited = await AuditLog.exists({
            action: 'DELETE',
            entity: job.targetType,
            entityId: job.targetId,
            'details.cascadeJobId': job._id
        });
        if (!alreadyAudited) {
            await logAudit('DELETE', job.targetType, job.targetId, actorId, {
                old: job.auditSnapshot,
                cascadeJobId: job._id,
                retentionState: job.retentionState,
                retainedAttachmentsCount: job.retainedAttachments.length,
                ...(isRecovery ? { recovered: true } : {})
            });
        }

        const now = new Date();
        job.status = 'completed';
        job.phase = 'completed';
        job.completedAt = now;
        if (isRecovery) job.recoveredAt = now;
        await job.save();

        return job;
    } catch (error) {
        job.status = 'failed';
        job.failedPhase = currentPhase;
        job.errorMessage = error?.message || 'Erro durante exclusão em cascata';
        try {
            await job.save();
        } catch (saveError) {
            logger.error('Falha ao persistir estado de erro da cascata', { err: saveError, cascadeJobId: job._id });
        }
        logger.error('Falha na exclusão em cascata; anexos físicos preservados para recuperação', {
            err: error,
            cascadeJobId: job._id,
            targetType: job.targetType,
            targetId: job.targetId,
            failedPhase: currentPhase
        });
        throw error;
    }
};

const executeProjectCascadeDeletion = async ({ projectId, userId, evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR }) => {
    const project = await Project.findById(projectId).lean();
    if (!project) return { notFound: true };

    const demandas = await Demanda.find({ project: project._id }).lean();
    const demandaIds = demandas.map((item) => item._id);
    const scenarioCount = demandaIds.length > 0
        ? await Scenario.countDocuments({ demanda: { $in: demandaIds } })
        : 0;
    const retainedAttachments = snapshotDemandaAttachments(demandas, evidenceBaseDir);

    const job = await CascadeDeletionJob.create({
        targetType: 'Project',
        targetId: project._id,
        targetLabel: project.title || '',
        requestedBy: userId,
        status: 'pending',
        phase: 'snapshot',
        scope: {
            projectId: project._id,
            demandaIds,
            demandaCount: demandas.length,
            scenarioCount
        },
        retentionState: 'retained',
        retainedAttachments,
        auditSnapshot: cleanAuditSnapshot(project)
    });

    await runCascadePhases(job, { userId, isRecovery: false });
    return { notFound: false, job };
};

const executeDemandaCascadeDeletion = async ({ demandaId, userId, evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR }) => {
    const demanda = await Demanda.findById(demandaId).lean();
    if (!demanda) return { notFound: true };

    const scenarioCount = await Scenario.countDocuments({ demanda: demanda._id });
    const retainedAttachments = snapshotDemandaAttachments([demanda], evidenceBaseDir);

    const job = await CascadeDeletionJob.create({
        targetType: 'Demanda',
        targetId: demanda._id,
        targetLabel: `${demanda.demandaId || ''} ${demanda.nome || ''}`.trim(),
        requestedBy: userId,
        status: 'pending',
        phase: 'snapshot',
        scope: {
            projectId: demanda.project || null,
            demandaIds: [demanda._id],
            demandaCount: 1,
            scenarioCount
        },
        retentionState: 'retained',
        retainedAttachments,
        auditSnapshot: cleanAuditSnapshot(demanda)
    });

    await runCascadePhases(job, { userId, isRecovery: false });
    return { notFound: false, job };
};

const recoverCascadeDeletion = async (jobId, { userId } = {}) => {
    const job = await CascadeDeletionJob.findById(jobId);
    if (!job) {
        const error = new Error('Registro de exclusão em cascata não encontrado.');
        error.code = 'CASCADE_JOB_NOT_FOUND';
        throw error;
    }
    if (job.status === 'completed') {
        return { job, alreadyCompleted: true };
    }
    await runCascadePhases(job, { userId, isRecovery: true });
    return { job, alreadyCompleted: false };
};

const recoverPendingCascades = async ({ userId } = {}) => {
    const pendingJobs = await CascadeDeletionJob.find({
        status: { $in: ['pending', 'in_progress', 'failed'] }
    }).sort({ createdAt: 1 });

    const recovered = [];
    const failed = [];
    for (const job of pendingJobs) {
        try {
            await recoverCascadeDeletion(job._id, { userId });
            recovered.push(job._id);
        } catch (error) {
            failed.push({ jobId: job._id, message: error.message });
        }
    }
    return { recovered, failed };
};

const approvePhysicalPurge = async (jobId) => {
    const job = await CascadeDeletionJob.findById(jobId);
    if (!job) throw new Error('Registro de exclusão em cascata não encontrado.');
    if (job.status !== 'completed') {
        throw new Error('A exclusão em cascata ainda não foi concluída; eliminação física bloqueada.');
    }
    if (job.retentionState === 'purged') return job;
    job.retentionState = 'approved_for_purge';
    await job.save();
    return job;
};

const collectActiveReferencedPaths = async (evidenceBaseDir) => {
    const activePaths = new Set();
    const activeDemandas = await Demanda.find({}, 'demandaId nome evidences').lean();
    for (const demanda of activeDemandas) {
        const candidates = candidateEvidenceDirsForDemanda(demanda);
        const evidences = Array.isArray(demanda.evidences) ? demanda.evidences : [];
        for (const evidence of evidences) {
            if (!evidence || typeof evidence.filename !== 'string') continue;
            for (const relativeDir of candidates) {
                const subdir = resolveEvidenceSubdir(evidenceBaseDir, relativeDir);
                const filePath = subdir && resolveEvidenceFile(subdir, evidence.filename);
                if (filePath) activePaths.add(path.resolve(filePath));
            }
        }
    }
    return activePaths;
};

const purgeRetainedAttachments = async (jobId, { evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR, userId } = {}) => {
    const job = await CascadeDeletionJob.findById(jobId);
    if (!job) throw new Error('Registro de exclusão em cascata não encontrado.');
    if (job.status !== 'completed') {
        throw new Error('A exclusão em cascata ainda não foi concluída; eliminação física bloqueada.');
    }
    if (job.retentionState !== 'approved_for_purge') {
        throw new Error('O registro não está aprovado para eliminação física.');
    }

    const activePaths = await collectActiveReferencedPaths(evidenceBaseDir);
    const touchedDirs = new Set();
    const summary = { removedFiles: 0, skippedSharedFiles: 0, missingFiles: 0 };

    for (const item of job.retainedAttachments) {
        const subdir = resolveEvidenceSubdir(evidenceBaseDir, item.relativeDir);
        const filePath = subdir && resolveEvidenceFile(subdir, item.filename);
        if (!filePath) continue;

        const resolvedFile = path.resolve(filePath);
        if (activePaths.has(resolvedFile)) {
            summary.skippedSharedFiles += 1;
            continue;
        }
        if (!fs.existsSync(resolvedFile)) { // eslint-disable-line security/detect-non-literal-fs-filename
            summary.missingFiles += 1;
            continue;
        }
        const stat = fs.lstatSync(resolvedFile); // eslint-disable-line security/detect-non-literal-fs-filename
        if (!stat.isFile()) continue;

        fs.unlinkSync(resolvedFile); // eslint-disable-line security/detect-non-literal-fs-filename
        summary.removedFiles += 1;
        touchedDirs.add(path.resolve(subdir));
    }

    for (const dir of touchedDirs) {
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) { // eslint-disable-line security/detect-non-literal-fs-filename
            fs.rmdirSync(dir); // eslint-disable-line security/detect-non-literal-fs-filename
        }
    }

    job.retentionState = 'purged';
    job.purgedAt = new Date();
    job.purgeSummary = summary;
    await job.save();

    await logAudit('DELETE', 'CascadeDeletionJob', job._id, userId || job.requestedBy, {
        summary: 'Eliminação física de anexos retidos concluída',
        targetType: job.targetType,
        targetId: job.targetId,
        purgeSummary: summary
    });

    return job;
};

module.exports = {
    approvePhysicalPurge,
    executeDemandaCascadeDeletion,
    executeProjectCascadeDeletion,
    purgeRetainedAttachments,
    recoverCascadeDeletion,
    recoverPendingCascades
};
