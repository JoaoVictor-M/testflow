const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { after, before, describe, mock, test } = require('node:test');
const mongoose = require('mongoose');
const { call, createEvidenceTracker, createProfiles, evidenceRoot } = require('./support/api');
const { connectTo, dropAndDisconnect } = require('./support/database');
const AuditLog = require('../models/AuditLog');
const CascadeDeletionJob = require('../models/CascadeDeletionJob');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');
const {
    approvePhysicalPurge,
    purgeRetainedAttachments,
    recoverCascadeDeletion,
    recoverPendingCascades
} = require('../services/cascadeDeletionService');

describe('exclusão em cascata, retenção de anexos e recuperação', () => {
    let analyst;
    let admin;
    let counter = 0;
    const evidence = createEvidenceTracker();

    before(async () => {
        await connectTo('testflow-test-cascade-deletion');
        ({ analyst, admin } = await createProfiles());
    });

    after(async () => {
        evidence.cleanup();
        await dropAndDisconnect();
    });

    const folderOf = (demanda) => path.join(evidenceRoot, `${demanda.demandaId}_${demanda.nome.replace(/\s+/g, '_')}`);

    const createHierarchyWithEvidence = async ({ demandaCode, demandaName, fileContent = 'evidencia-retida' } = {}) => {
        counter += 1;
        const project = await Project.create({ title: `Projeto cascata ${counter}` });
        const demanda = await Demanda.create({
            demandaId: demandaCode || `CSC${evidence.prefix}${counter}`,
            nome: demandaName || `Demanda cascata ${counter}`,
            project: project._id
        });
        evidence.track(folderOf(demanda));
        const upload = await call('post', `/api/demandas/${demanda._id}/evidence`, analyst.token)
            .attach('file', Buffer.from(fileContent), { filename: 'prova.txt', contentType: 'text/plain' });
        assert.equal(upload.status, 201);
        const scenario = await Scenario.create({
            title: `Cenário cascata ${counter}`,
            description: 'Descrição sintética',
            steps: ['Passo 1'],
            expectedResult: 'Ok',
            demanda: demanda._id
        });
        const uploaded = upload.body.evidences[0];
        const filePath = path.join(folderOf(demanda), uploaded.filename);
        const expectedSha256 = crypto.createHash('sha256').update(fileContent).digest('hex');
        return { project, demanda, scenario, uploaded, filePath, expectedSha256 };
    };

    test('excluir demanda remove documentos de negócio, retém anexo físico e registra trilha com checksum', async () => {
        const { demanda, scenario, uploaded, filePath, expectedSha256 } = await createHierarchyWithEvidence();

        const response = await call('delete', `/api/demandas/${demanda._id}`, analyst.token);

        assert.equal(response.status, 200);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.equal(fs.existsSync(filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const job = await CascadeDeletionJob.findOne({ targetType: 'Demanda', targetId: demanda._id }).lean();
        assert.ok(job);
        assert.equal(job.status, 'completed');
        assert.equal(job.phase, 'completed');
        assert.equal(job.retentionState, 'retained');
        assert.equal(job.retainedAttachments.length, 1);
        assert.equal(job.retainedAttachments[0].filename, uploaded.filename);
        assert.equal(job.retainedAttachments[0].sha256, expectedSha256);

        const audit = await AuditLog.findOne({ entity: 'Demanda', entityId: demanda._id, action: 'DELETE' }).lean();
        assert.ok(audit);
        assert.equal(audit.details.cascadeJobId.toString(), job._id.toString());
        assert.equal(audit.details.retentionState, 'retained');
    });

    test('excluir projeto remove demandas e cenários, retém anexos de todas as demandas e registra job concluído', async () => {
        const { project, demanda, scenario, uploaded, filePath } = await createHierarchyWithEvidence();

        const response = await call('delete', `/api/projects/${project._id}`, analyst.token);

        assert.equal(response.status, 200);
        assert.equal(await Project.exists({ _id: project._id }), null);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.equal(fs.existsSync(filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const job = await CascadeDeletionJob.findOne({ targetType: 'Project', targetId: project._id }).lean();
        assert.ok(job);
        assert.equal(job.status, 'completed');
        assert.equal(job.retentionState, 'retained');
        assert.deepEqual(job.scope.demandaIds.map(String), [demanda._id.toString()]);
        assert.equal(job.retainedAttachments.length, 1);
        assert.equal(job.retainedAttachments[0].filename, uploaded.filename);
    });

    test('interrupção no meio da cascata persiste falha, preserva anexos e permite recuperação idempotente', async () => {
        const { project, demanda, scenario, filePath } = await createHierarchyWithEvidence();

        const failOnce = mock.method(Demanda, 'deleteMany', async () => {
            throw new Error('falha simulada na exclusão de demandas');
        });
        let response;
        try {
            response = await call('delete', `/api/projects/${project._id}`, analyst.token);
        } finally {
            failOnce.mock.restore();
        }

        assert.equal(response.status, 500);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.ok(await Demanda.exists({ _id: demanda._id }));
        assert.ok(await Project.exists({ _id: project._id }));
        assert.equal(fs.existsSync(filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const failedJob = await CascadeDeletionJob.findOne({ targetType: 'Project', targetId: project._id }).lean();
        assert.ok(failedJob);
        assert.equal(failedJob.status, 'failed');
        assert.equal(failedJob.failedPhase, 'deleting_demandas');
        assert.equal(failedJob.retentionState, 'retained');
        assert.equal(failedJob.attempts, 1);

        const recovery = await recoverPendingCascades({ userId: admin.user._id });
        assert.ok(recovery.recovered.some((id) => id.toString() === failedJob._id.toString()));
        assert.equal(recovery.failed.length, 0);

        assert.equal(await Project.exists({ _id: project._id }), null);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.equal(fs.existsSync(filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const recoveredJob = await CascadeDeletionJob.findById(failedJob._id).lean();
        assert.equal(recoveredJob.status, 'completed');
        assert.equal(recoveredJob.retentionState, 'retained');
        assert.equal(recoveredJob.attempts, 2);
        assert.ok(recoveredJob.recoveredAt);

        const secondRecovery = await recoverCascadeDeletion(failedJob._id, { userId: admin.user._id });
        assert.equal(secondRecovery.alreadyCompleted, true);
        assert.equal((await AuditLog.countDocuments({ entity: 'Project', entityId: project._id, action: 'DELETE' })), 1);
    });

    test('eliminação física recusa job retido sem aprovação e só remove arquivos não compartilhados após aprovação', async () => {
        const sharedCode = `SHR${evidence.prefix}`;
        const sharedName = 'Pasta compartilhada';
        const first = await createHierarchyWithEvidence({
            demandaCode: sharedCode,
            demandaName: sharedName,
            fileContent: 'arquivo-exclusivo-ou-compartilhado'
        });

        // Outra demanda ativa referenciando exatamente o mesmo arquivo na mesma pasta derivada.
        const activeDemanda = await Demanda.create({
            demandaId: sharedCode,
            nome: sharedName,
            project: first.project._id,
            evidences: [{
                filename: first.uploaded.filename,
                originalName: first.uploaded.originalName,
                mimetype: 'text/plain',
                size: first.uploaded.size
            }]
        });

        // Adiciona um segundo arquivo exclusivo na primeira demanda antes de excluí-la.
        const secondUpload = await call('post', `/api/demandas/${first.demanda._id}/evidence`, analyst.token)
            .attach('file', Buffer.from('arquivo-exclusivo'), { filename: 'exclusivo.txt', contentType: 'text/plain' });
        assert.equal(secondUpload.status, 201);
        const exclusiveEvidence = secondUpload.body.evidences[1];
        const exclusivePath = path.join(folderOf(first.demanda), exclusiveEvidence.filename);

        const delResponse = await call('delete', `/api/demandas/${first.demanda._id}`, analyst.token);
        assert.equal(delResponse.status, 200);

        const job = await CascadeDeletionJob.findOne({ targetType: 'Demanda', targetId: first.demanda._id });
        assert.equal(job.retentionState, 'retained');

        // Sem aprovação explícita de eliminação física, a purga deve ser recusada.
        await assert.rejects(
            () => purgeRetainedAttachments(job._id, { evidenceBaseDir: evidenceRoot, userId: admin.user._id }),
            /não está aprovado para eliminação física/
        );
        assert.equal(fs.existsSync(exclusivePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        await approvePhysicalPurge(job._id);
        const purgeResult = await purgeRetainedAttachments(job._id, {
            evidenceBaseDir: evidenceRoot,
            userId: admin.user._id
        });

        assert.equal(purgeResult.retentionState, 'purged');
        assert.equal(purgeResult.purgeSummary.removedFiles, 1);
        assert.equal(purgeResult.purgeSummary.skippedSharedFiles, 1);
        assert.equal(fs.existsSync(exclusivePath), false); // eslint-disable-line security/detect-non-literal-fs-filename
        assert.equal(fs.existsSync(first.filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        await Demanda.deleteOne({ _id: activeDemanda._id });
        await Project.deleteOne({ _id: first.project._id });
    });

    test('eliminação física recusa job incompleto e bloqueia tentativa de path traversal', async () => {
        const outsideFile = path.join(evidenceRoot, `outside-${evidence.prefix}.txt`);
        fs.writeFileSync(outsideFile, 'nao-apagar'); // eslint-disable-line security/detect-non-literal-fs-filename
        try {
            const incompleteJob = await CascadeDeletionJob.create({
                targetType: 'Demanda',
                targetId: new mongoose.Types.ObjectId(),
                requestedBy: analyst.user._id,
                status: 'failed',
                phase: 'deleting_demandas',
                retentionState: 'approved_for_purge',
                retainedAttachments: [{ relativeDir: 'qualquer', filename: 'x.txt' }]
            });
            await assert.rejects(
                () => purgeRetainedAttachments(incompleteJob._id, { evidenceBaseDir: evidenceRoot, userId: admin.user._id }),
                /ainda não foi concluída/
            );

            const traversalJob = await CascadeDeletionJob.create({
                targetType: 'Demanda',
                targetId: new mongoose.Types.ObjectId(),
                requestedBy: analyst.user._id,
                status: 'completed',
                phase: 'completed',
                retentionState: 'approved_for_purge',
                retainedAttachments: [
                    { relativeDir: '..', filename: path.basename(outsideFile) },
                    { relativeDir: 'sub', filename: `../${path.basename(outsideFile)}` }
                ]
            });
            const result = await purgeRetainedAttachments(traversalJob._id, {
                evidenceBaseDir: evidenceRoot,
                userId: admin.user._id
            });
            assert.equal(result.purgeSummary.removedFiles, 0);
            assert.equal(fs.existsSync(outsideFile), true); // eslint-disable-line security/detect-non-literal-fs-filename
        } finally {
            fs.rmSync(outsideFile, { force: true });
        }
    });
});
