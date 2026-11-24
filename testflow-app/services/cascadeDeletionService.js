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
const MAX_RECONCILE_PASSES = 5;

const attachmentKey = (item) => `${String(item.demandaId || '')}::${item.relativeDir || ''}::${item.filename}`;

const mergeRetainedAttachments = (existing, discovered) => {
    const merged = [];
    const indexByKey = new Map();

    for (const item of Array.isArray(existing) ? existing : []) {
        if (!item || !item.filename) continue;
        const plain = typeof item.toObject === 'function' ? item.toObject() : { ...item };
        const key = attachmentKey(plain);
        if (!indexByKey.has(key)) {
            indexByKey.set(key, merged.length);
            merged.push(plain);
        }
    }

    for (const item of Array.isArray(discovered) ? discovered : []) {
        if (!item || !item.filename) continue;
        const key = attachmentKey(item);
        const existingIndex = indexByKey.get(key);
        if (existingIndex === undefined) {
            indexByKey.set(key, merged.length);
            merged.push(item);
        } else {
            const current = merged[existingIndex];
            if (!current.sha256 && item.sha256) current.sha256 = item.sha256;
            if (!current.size && item.size) current.size = item.size;
            if (!current.originalName && item.originalName) current.originalName = item.originalName;
        }
    }

    return merged;
};

const reconcileCascadeScope = async (job, evidenceBaseDir, previousFailedPhase) => {
    const currentDemandas = job.targetType === 'Project'
        ? await Demanda.find({ project: job.targetId }).lean()
        : await Demanda.find({ _id: job.targetId }).lean();

    const mergedDemandaIds = [];
    const seenIds = new Set();
    const addDemandaId = (id) => {
        if (!id) return;
        const key = String(id);
        if (seenIds.has(key)) return;
        seenIds.add(key);
        mergedDemandaIds.push(id);
    };

    for (const id of job.scope?.demandaIds || []) addDemandaId(id);
    if (job.targetType === 'Demanda') addDemandaId(job.targetId);
    for (const demanda of currentDemandas) addDemandaId(demanda._id);

    const discoveredAttachments = snapshotDemandaAttachments(currentDemandas, evidenceBaseDir);
    job.retainedAttachments = mergeRetainedAttachments(job.retainedAttachments, discoveredAttachments);

    const remainingScenarios = mergedDemandaIds.length > 0
        ? await Scenario.countDocuments({ demanda: { $in: mergedDemandaIds } })
        : 0;
    const priorScenarioCount = job.scope?.scenarioCount || 0;
    const scenarioCount = (previousFailedPhase === 'deleting_demandas' || previousFailedPhase === 'deleting_project')
        ? priorScenarioCount + remainingScenarios
        : Math.max(priorScenarioCount, remainingScenarios);

    job.scope = {
        projectId: job.scope?.projectId || (job.targetType === 'Project' ? job.targetId : currentDemandas[0]?.project || null),
        demandaIds: mergedDemandaIds,
        demandaCount: mergedDemandaIds.length,
        scenarioCount
    };

    return { demandaIds: mergedDemandaIds };
};

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

const runCascadePhases = async (job, { userId, isRecovery = false, evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR }) => {
    let currentPhase = 'deleting_scenarios';
    const actorId = userId || job.requestedBy;
    const previousFailedPhase = job.failedPhase;

    try {
        job.status = 'in_progress';
        job.attempts = (job.attempts || 0) + 1;
        job.failedPhase = null;
        job.errorMessage = '';

        for (let pass = 0; pass < MAX_RECONCILE_PASSES; pass += 1) {
            const phaseHint = pass === 0 ? previousFailedPhase : 'deleting_demandas';
            const { demandaIds } = await reconcileCascadeScope(job, evidenceBaseDir, phaseHint);

            currentPhase = 'deleting_scenarios';
            job.phase = currentPhase;
            await job.save();

            if (demandaIds.length > 0) {
                await Scenario.deleteMany({ demanda: { $in: demandaIds } });
            }

            currentPhase = 'deleting_demandas';
            job.phase = currentPhase;
            await job.save();

            if (demandaIds.length > 0) {
                await Demanda.deleteMany({ _id: { $in: demandaIds } });
            }

            if (job.targetType !== 'Project') break;

            const hasNewDemandas = await Demanda.exists({ project: job.targetId });
            if (!hasNewDemandas) break;
            if (pass === MAX_RECONCILE_PASSES - 1) {
                throw new Error('Exclusão em cascata do projeto interrompida por novas demandas concorrentes.');
            }
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

    await runCascadePhases(job, { userId, isRecovery: false, evidenceBaseDir });
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

    await runCascadePhases(job, { userId, isRecovery: false, evidenceBaseDir });
    return { notFound: false, job };
};

const recoverCascadeDeletion = async (jobId, { userId, evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR } = {}) => {
    const job = await CascadeDeletionJob.findById(jobId);
    if (!job) {
        const error = new Error('Registro de exclusão em cascata não encontrado.');
        error.code = 'CASCADE_JOB_NOT_FOUND';
        throw error;
    }
    if (job.status === 'completed') {
        return { job, alreadyCompleted: true };
    }
    await runCascadePhases(job, { userId, isRecovery: true, evidenceBaseDir });
    return { job, alreadyCompleted: false };
};

const recoverPendingCascades = async ({ userId, evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR } = {}) => {
    const pendingJobs = await CascadeDeletionJob.find({
        status: { $in: ['pending', 'in_progress', 'failed'] }
    }).sort({ createdAt: 1 });

    const recovered = [];
    const failed = [];
    for (const job of pendingJobs) {
        try {
            await recoverCascadeDeletion(job._id, { userId, evidenceBaseDir });
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

const collectProtectedJobPaths = async (evidenceBaseDir, excludeJobId) => {
    const protectedPaths = new Set();
    const otherJobs = await CascadeDeletionJob.find(
        {
            _id: { $ne: excludeJobId },
            $or: [
                { retentionState: 'retained' },
                { status: { $ne: 'completed' } }
            ]
        },
        'retainedAttachments'
    ).lean();

    for (const otherJob of otherJobs) {
        const attachments = Array.isArray(otherJob.retainedAttachments) ? otherJob.retainedAttachments : [];
        for (const item of attachments) {
            if (!item || typeof item.filename !== 'string' || !item.filename) continue;
            const dirs = new Set();
            if (typeof item.relativeDir === 'string' && item.relativeDir) {
                dirs.add(item.relativeDir);
            }
            if (item.demandaCode || item.demandaName) {
                for (const candidate of candidateEvidenceDirsForDemanda({
                    demandaId: item.demandaCode,
                    nome: item.demandaName
                })) {
                    dirs.add(candidate);
                }
            }
            for (const relativeDir of dirs) {
                const subdir = resolveEvidenceSubdir(evidenceBaseDir, relativeDir);
                const filePath = subdir && resolveEvidenceFile(subdir, item.filename);
                if (filePath) protectedPaths.add(path.resolve(filePath));
            }
        }
    }
    return protectedPaths;
};

const collectProtectedEvidencePaths = async (evidenceBaseDir, excludeJobId) => {
    const [activePaths, jobPaths] = await Promise.all([
        collectActiveReferencedPaths(evidenceBaseDir),
        collectProtectedJobPaths(evidenceBaseDir, excludeJobId)
    ]);
    for (const filePath of jobPaths) activePaths.add(filePath);
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

    const protectedPaths = await collectProtectedEvidencePaths(evidenceBaseDir, job._id);
    const touchedDirs = new Set();
    const processedFiles = new Set();
    const summary = { removedFiles: 0, skippedSharedFiles: 0, missingFiles: 0 };

    for (const item of job.retainedAttachments) {
        const subdir = resolveEvidenceSubdir(evidenceBaseDir, item.relativeDir);
        const filePath = subdir && resolveEvidenceFile(subdir, item.filename);
        if (!filePath) continue;

        const resolvedFile = path.resolve(filePath);
        if (processedFiles.has(resolvedFile)) continue;
        processedFiles.add(resolvedFile);

        if (protectedPaths.has(resolvedFile)) {
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
