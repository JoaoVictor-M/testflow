const assert = require('node:assert/strict');
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
    recoverCascadeDeletion,
    recoverPendingCascades
} = require('../services/cascadeDeletionService');

describe('exclusão em cascata de documentos e arquivos com recuperação', () => {
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

    const createHierarchyWithEvidence = async ({ demandaCode, demandaName, fileContent = 'evidencia-cascata' } = {}) => {
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
        return { project, demanda, scenario, uploaded, filePath };
    };

    test('excluir demanda remove documentos, anexo físico e pasta vazia registrando trilha', async () => {
        const { demanda, scenario, uploaded, filePath } = await createHierarchyWithEvidence();

        const response = await call('delete', `/api/demandas/${demanda._id}`, analyst.token);

        assert.equal(response.status, 200);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.equal(fs.existsSync(filePath), false); // eslint-disable-line security/detect-non-literal-fs-filename
        assert.equal(fs.existsSync(folderOf(demanda)), false); // eslint-disable-line security/detect-non-literal-fs-filename

        const job = await CascadeDeletionJob.findOne({ targetType: 'Demanda', targetId: demanda._id }).lean();
        assert.ok(job);
        assert.equal(job.status, 'completed');
        assert.equal(job.phase, 'completed');
        assert.equal(job.attachments.length, 1);
        assert.equal(job.attachments[0].filename, uploaded.filename);
        assert.equal(job.fileCleanupSummary.removedFiles, 1);
        assert.equal(job.fileCleanupSummary.skippedSharedFiles, 0);

        const audit = await AuditLog.findOne({ entity: 'Demanda', entityId: demanda._id, action: 'DELETE' }).lean();
        assert.ok(audit);
        assert.equal(audit.details.cascadeJobId.toString(), job._id.toString());
        assert.equal(audit.details.fileCleanupSummary.removedFiles, 1);
    });

    test('excluir projeto remove demandas, cenários e anexos físicos sem deixar arquivo órfão', async () => {
        const { project, demanda, scenario, uploaded, filePath } = await createHierarchyWithEvidence();

        const response = await call('delete', `/api/projects/${project._id}`, analyst.token);

        assert.equal(response.status, 200);
        assert.equal(await Project.exists({ _id: project._id }), null);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.equal(fs.existsSync(filePath), false); // eslint-disable-line security/detect-non-literal-fs-filename
        assert.equal(fs.existsSync(folderOf(demanda)), false); // eslint-disable-line security/detect-non-literal-fs-filename

        const job = await CascadeDeletionJob.findOne({ targetType: 'Project', targetId: project._id }).lean();
        assert.ok(job);
        assert.equal(job.status, 'completed');
        assert.deepEqual(job.scope.demandaIds.map(String), [demanda._id.toString()]);
        assert.equal(job.attachments.length, 1);
        assert.equal(job.attachments[0].filename, uploaded.filename);
        assert.equal(job.fileCleanupSummary.removedFiles, 1);
    });

    test('interrupção no meio da cascata no banco preserva anexos até a recuperação e conclui removendo documentos e arquivos', async () => {
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
        // Sem limpeza física antecipada enquanto a exclusão no banco não concluiu.
        assert.equal(fs.existsSync(filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const failedJob = await CascadeDeletionJob.findOne({ targetType: 'Project', targetId: project._id }).lean();
        assert.ok(failedJob);
        assert.equal(failedJob.status, 'failed');
        assert.equal(failedJob.failedPhase, 'deleting_demandas');
        assert.equal(failedJob.attempts, 1);

        const recovery = await recoverPendingCascades({ userId: admin.user._id, evidenceBaseDir: evidenceRoot });
        assert.ok(recovery.recovered.some((id) => id.toString() === failedJob._id.toString()));
        assert.equal(recovery.failed.length, 0);

        assert.equal(await Project.exists({ _id: project._id }), null);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);
        assert.equal(fs.existsSync(filePath), false); // eslint-disable-line security/detect-non-literal-fs-filename

        const recoveredJob = await CascadeDeletionJob.findById(failedJob._id).lean();
        assert.equal(recoveredJob.status, 'completed');
        assert.equal(recoveredJob.attempts, 2);
        assert.equal(recoveredJob.fileCleanupSummary.removedFiles, 1);
        assert.ok(recoveredJob.recoveredAt);

        const secondRecovery = await recoverCascadeDeletion(failedJob._id, { userId: admin.user._id, evidenceBaseDir: evidenceRoot });
        assert.equal(secondRecovery.alreadyCompleted, true);
        assert.equal((await AuditLog.countDocuments({ entity: 'Project', entityId: project._id, action: 'DELETE' })), 1);
    });

    test('retomada reconcilia escopo e anexos quando nova demanda e cenário são criados após falha', async () => {
        const { project, demanda, scenario, filePath } = await createHierarchyWithEvidence({
            fileContent: 'evidencia-inicial-projeto'
        });

        const failOnce = mock.method(Demanda, 'deleteMany', async () => {
            throw new Error('falha simulada antes da remoção das demandas');
        });
        let response;
        try {
            response = await call('delete', `/api/projects/${project._id}`, analyst.token);
        } finally {
            failOnce.mock.restore();
        }
        assert.equal(response.status, 500);
        assert.equal(await Scenario.exists({ _id: scenario._id }), null);

        const extraDemanda = await Demanda.create({
            demandaId: `REC${evidence.prefix}${counter}`,
            nome: 'Demanda pós falha',
            project: project._id
        });
        evidence.track(folderOf(extraDemanda));
        const extraUpload = await call('post', `/api/demandas/${extraDemanda._id}/evidence`, analyst.token)
            .attach('file', Buffer.from('evidencia-pos-falha'), { filename: 'pos-falha.txt', contentType: 'text/plain' });
        assert.equal(extraUpload.status, 201);
        const extraFilePath = path.join(folderOf(extraDemanda), extraUpload.body.evidences[0].filename);

        const extraScenario = await Scenario.create({
            title: 'Cenário pós falha',
            description: 'Não pode ficar órfão na retomada',
            steps: ['Passo 1'],
            expectedResult: 'Removido na retomada',
            demanda: extraDemanda._id
        });

        const lateUpload = await call('post', `/api/demandas/${demanda._id}/evidence`, analyst.token)
            .attach('file', Buffer.from('evidencia-tardia'), { filename: 'tardia.txt', contentType: 'text/plain' });
        assert.equal(lateUpload.status, 201);
        const lateFilePath = path.join(folderOf(demanda), lateUpload.body.evidences[1].filename);

        const lateScenario = await Scenario.create({
            title: 'Cenário tardio na demanda original',
            description: 'Também deve ser removido na retomada',
            steps: ['Passo 1'],
            expectedResult: 'Removido na retomada',
            demanda: demanda._id
        });

        const failedJob = await CascadeDeletionJob.findOne({ targetType: 'Project', targetId: project._id }).lean();
        const recovery = await recoverPendingCascades({ userId: admin.user._id, evidenceBaseDir: evidenceRoot });
        assert.ok(recovery.recovered.some((id) => id.toString() === failedJob._id.toString()));
        assert.equal(recovery.failed.length, 0);

        assert.equal(await Project.exists({ _id: project._id }), null);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(await Demanda.exists({ _id: extraDemanda._id }), null);
        assert.equal(await Scenario.exists({ _id: extraScenario._id }), null);
        assert.equal(await Scenario.exists({ _id: lateScenario._id }), null);
        assert.equal(fs.existsSync(filePath), false); // eslint-disable-line security/detect-non-literal-fs-filename
        assert.equal(fs.existsSync(extraFilePath), false); // eslint-disable-line security/detect-non-literal-fs-filename
        assert.equal(fs.existsSync(lateFilePath), false); // eslint-disable-line security/detect-non-literal-fs-filename

        const recoveredJob = await CascadeDeletionJob.findById(failedJob._id).lean();
        assert.equal(recoveredJob.status, 'completed');
        assert.equal(recoveredJob.scope.demandaCount, 2);
        assert.deepEqual(
            recoveredJob.scope.demandaIds.map(String).sort(),
            [demanda._id.toString(), extraDemanda._id.toString()].sort()
        );
        assert.equal(recoveredJob.attachments.length, 3);
        assert.equal(recoveredJob.fileCleanupSummary.removedFiles, 3);

        const audit = await AuditLog.findOne({ entity: 'Project', entityId: project._id, action: 'DELETE' }).lean();
        assert.equal(audit.details.fileCleanupSummary.removedFiles, 3);
        assert.equal(audit.details.recovered, true);
    });

    test('falha durante remoção física registra deleting_files e recuperação remove o arquivo pendente', async () => {
        const { demanda, filePath } = await createHierarchyWithEvidence({ fileContent: 'falha-unlink' });

        const failUnlink = mock.method(fs, 'unlinkSync', () => {
            throw new Error('falha simulada no filesystem');
        });
        let response;
        try {
            response = await call('delete', `/api/demandas/${demanda._id}`, analyst.token);
        } finally {
            failUnlink.mock.restore();
        }

        assert.equal(response.status, 500);
        assert.equal(await Demanda.exists({ _id: demanda._id }), null);
        assert.equal(fs.existsSync(filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const failedJob = await CascadeDeletionJob.findOne({ targetType: 'Demanda', targetId: demanda._id }).lean();
        assert.equal(failedJob.status, 'failed');
        assert.equal(failedJob.failedPhase, 'deleting_files');

        const recovery = await recoverPendingCascades({ userId: admin.user._id, evidenceBaseDir: evidenceRoot });
        assert.ok(recovery.recovered.some((id) => id.toString() === failedJob._id.toString()));
        assert.equal(fs.existsSync(filePath), false); // eslint-disable-line security/detect-non-literal-fs-filename

        const recoveredJob = await CascadeDeletionJob.findById(failedJob._id).lean();
        assert.equal(recoveredJob.status, 'completed');
        assert.equal(recoveredJob.fileCleanupSummary.removedFiles, 1);
    });

    test('exclusão preserva arquivo compartilhado por demanda ativa ou job incompleto e bloqueia path traversal', async () => {
        const sharedCode = `SHR${evidence.prefix}`;
        const sharedName = 'Pasta compartilhada';
        const first = await createHierarchyWithEvidence({
            demandaCode: sharedCode,
            demandaName: sharedName,
            fileContent: 'arquivo-compartilhado'
        });

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

        const exclusiveUpload = await call('post', `/api/demandas/${first.demanda._id}/evidence`, analyst.token)
            .attach('file', Buffer.from('arquivo-exclusivo'), { filename: 'exclusivo.txt', contentType: 'text/plain' });
        assert.equal(exclusiveUpload.status, 201);
        const exclusivePath = path.join(folderOf(first.demanda), exclusiveUpload.body.evidences[1].filename);

        const delFirst = await call('delete', `/api/demandas/${first.demanda._id}`, analyst.token);
        assert.equal(delFirst.status, 200);
        assert.equal(fs.existsSync(exclusivePath), false); // eslint-disable-line security/detect-non-literal-fs-filename
        assert.equal(fs.existsSync(first.filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        const jobFirst = await CascadeDeletionJob.findOne({ targetType: 'Demanda', targetId: first.demanda._id }).lean();
        assert.equal(jobFirst.fileCleanupSummary.removedFiles, 1);
        assert.equal(jobFirst.fileCleanupSummary.skippedSharedFiles, 1);

        // Outro job incompleto referenciando o arquivo impede a remoção enquanto não conclui.
        const incompleteJob = await CascadeDeletionJob.create({
            targetType: 'Demanda',
            targetId: new mongoose.Types.ObjectId(),
            requestedBy: analyst.user._id,
            status: 'failed',
            phase: 'deleting_demandas',
            attachments: [{
                relativeDir: jobFirst.attachments[0].relativeDir,
                filename: first.uploaded.filename
            }]
        });

        const delSecond = await call('delete', `/api/demandas/${activeDemanda._id}`, analyst.token);
        assert.equal(delSecond.status, 200);
        assert.equal(fs.existsSync(first.filePath), true); // eslint-disable-line security/detect-non-literal-fs-filename

        // Ao recuperar o job incompleto, sem mais referências ativas, o arquivo é removido.
        await recoverCascadeDeletion(incompleteJob._id, { userId: admin.user._id, evidenceBaseDir: evidenceRoot });
        assert.equal(fs.existsSync(first.filePath), false); // eslint-disable-line security/detect-non-literal-fs-filename

        // Path traversal em job de recuperação nunca apaga arquivos fora da raiz de evidências.
        const outsideFile = path.join(evidenceRoot, `outside-${evidence.prefix}.txt`);
        fs.writeFileSync(outsideFile, 'nao-apagar'); // eslint-disable-line security/detect-non-literal-fs-filename
        try {
            const traversalJob = await CascadeDeletionJob.create({
                targetType: 'Demanda',
                targetId: new mongoose.Types.ObjectId(),
                requestedBy: analyst.user._id,
                status: 'failed',
                phase: 'deleting_files',
                failedPhase: 'deleting_files',
                attachments: [
                    { relativeDir: '..', filename: path.basename(outsideFile) },
                    { relativeDir: 'sub', filename: `../${path.basename(outsideFile)}` }
                ]
            });
            const { job } = await recoverCascadeDeletion(traversalJob._id, {
                evidenceBaseDir: evidenceRoot,
                userId: admin.user._id
            });
            assert.equal(job.fileCleanupSummary.removedFiles, 0);
            assert.equal(fs.existsSync(outsideFile), true); // eslint-disable-line security/detect-non-literal-fs-filename
        } finally {
            fs.rmSync(outsideFile, { force: true });
        }

        await Project.deleteOne({ _id: first.project._id });
    });
});
