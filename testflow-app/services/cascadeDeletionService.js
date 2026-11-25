const fs = require('fs');
const path = require('path');
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

const isFileStillReferenced = async (targetPath, filename, evidenceBaseDir) => {
    const normalizedTarget = path.resolve(targetPath);
    const activeDemandas = await Demanda.find(
        { 'evidences.filename': filename },
        'demandaId nome'
    ).lean();

    for (const demanda of activeDemandas) {
        for (const relativeDir of candidateEvidenceDirsForDemanda(demanda)) {
            const subdir = resolveEvidenceSubdir(evidenceBaseDir, relativeDir);
            const candidatePath = subdir && resolveEvidenceFile(subdir, filename);
            if (candidatePath && path.resolve(candidatePath) === normalizedTarget) {
                return true;
            }
        }
    }

    return false;
};

const cleanupDemandasEvidenceFiles = async ({
    demandas,
    targetType,
    targetId,
    evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR
}) => {
    if (!evidenceBaseDir || !Array.isArray(demandas) || demandas.length === 0) return;

    const dirsToPrune = new Set();

    for (const demanda of demandas) {
        const evidences = Array.isArray(demanda.evidences) ? demanda.evidences : [];
        const candidateDirs = candidateEvidenceDirsForDemanda(demanda);

        for (const relativeDir of candidateDirs) {
            const subdir = resolveEvidenceSubdir(evidenceBaseDir, relativeDir);
            if (subdir) dirsToPrune.add(subdir);
        }

        for (const evidence of evidences) {
            if (!evidence || typeof evidence.filename !== 'string' || !evidence.filename) continue;

            for (const relativeDir of candidateDirs) {
                const subdir = resolveEvidenceSubdir(evidenceBaseDir, relativeDir);
                const filePath = subdir && resolveEvidenceFile(subdir, evidence.filename);
                if (!filePath) continue;

                try {
                    if (await isFileStillReferenced(filePath, evidence.filename, evidenceBaseDir)) {
                        continue;
                    }
                    await fs.promises.unlink(filePath); // eslint-disable-line security/detect-non-literal-fs-filename
                } catch (err) {
                    if (err && err.code === 'ENOENT') continue;
                    logger.error('Falha ao remover arquivo de evidência após exclusão', {
                        targetType,
                        targetId: String(targetId),
                        demandaId: String(demanda._id),
                        evidenceId: evidence._id ? String(evidence._id) : undefined,
                        code: err && err.code ? String(err.code) : 'FS_ERROR'
                    });
                }
            }
        }
    }

    for (const dirPath of dirsToPrune) {
        try {
            await fs.promises.rmdir(dirPath); // eslint-disable-line security/detect-non-literal-fs-filename
        } catch (err) {
            if (err && ['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(err.code)) continue;
            logger.error('Falha ao remover pasta vazia de evidência após exclusão', {
                targetType,
                targetId: String(targetId),
                code: err && err.code ? String(err.code) : 'FS_ERROR'
            });
        }
    }
};

const executeProjectCascadeDeletion = async ({
    projectId,
    userId,
    evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR
}) => {
    const project = await Project.findById(projectId).lean();
    if (!project) return { notFound: true };

    const demandas = await Demanda.find({ project: projectId }).lean();
    const demandaIds = demandas.map((demanda) => demanda._id);

    if (demandaIds.length > 0) {
        await Scenario.deleteMany({ demanda: { $in: demandaIds } });
    }
    await Demanda.deleteMany({ project: projectId });
    const deletedProject = await Project.findByIdAndDelete(projectId).lean();
    await logAudit('DELETE', 'Project', projectId, userId, {
        old: cleanAuditSnapshot(deletedProject || project)
    });

    await cleanupDemandasEvidenceFiles({
        demandas,
        targetType: 'Project',
        targetId: projectId,
        evidenceBaseDir
    });

    return { notFound: false };
};

const executeDemandaCascadeDeletion = async ({
    demandaId,
    userId,
    evidenceBaseDir = DEFAULT_EVIDENCE_BASE_DIR
}) => {
    const demanda = await Demanda.findById(demandaId).lean();
    if (!demanda) return { notFound: true };

    await Scenario.deleteMany({ demanda: demandaId });
    const deletedDemanda = await Demanda.findByIdAndDelete(demandaId).lean();
    await logAudit('DELETE', 'Demanda', demandaId, userId, {
        old: cleanAuditSnapshot(deletedDemanda || demanda)
    });

    await cleanupDemandasEvidenceFiles({
        demandas: [demanda],
        targetType: 'Demanda',
        targetId: demandaId,
        evidenceBaseDir
    });

    return { notFound: false };
};

module.exports = {
    executeDemandaCascadeDeletion,
    executeProjectCascadeDeletion
};
