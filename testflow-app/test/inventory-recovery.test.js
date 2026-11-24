const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, describe, test } = require('node:test');
const mongoose = require('mongoose');
const { connectTo, dropAndDisconnect } = require('./support/database');
const CascadeDeletionJob = require('../models/CascadeDeletionJob');
const Demanda = require('../models/Demanda');
const Project = require('../models/Project');
const Scenario = require('../models/Scenario');
const SystemConfig = require('../models/SystemConfig');
const User = require('../models/User');
const { buildInventory, verifyRestoredInventory } = require('../services/inventoryService');

describe('inventário conjunto e verificação de restauração', () => {
    let tmpDir;
    let sourceEvidenceDir;
    let restoredEvidenceDir;
    let allowlistPath;
    let versionPath;
    let packageJsonPath;

    before(async () => {
        await connectTo('testflow-test-inventory-recovery');
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testflow-inventory-'));
        sourceEvidenceDir = path.join(tmpDir, 'source-evidence');
        restoredEvidenceDir = path.join(tmpDir, 'restored-evidence');
        fs.mkdirSync(sourceEvidenceDir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.mkdirSync(restoredEvidenceDir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename

        allowlistPath = path.join(tmpDir, 'allowlist.json');
        versionPath = path.join(tmpDir, 'VERSION');
        packageJsonPath = path.join(tmpDir, 'package.json');
        fs.writeFileSync(allowlistPath, JSON.stringify({ mantis: 'https://mantis.example.test/' })); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.writeFileSync(versionPath, '1.0.1\n'); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.writeFileSync(packageJsonPath, JSON.stringify({ name: 'testflow-app', version: '1.0.1' })); // eslint-disable-line security/detect-non-literal-fs-filename
    });

    after(async () => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        await dropAndDisconnect();
    });

    const seedState = async () => {
        await Promise.all([
            Project.deleteMany({}),
            Demanda.deleteMany({}),
            Scenario.deleteMany({}),
            SystemConfig.deleteMany({}),
            CascadeDeletionJob.deleteMany({}),
            User.deleteMany({})
        ]);
        fs.rmSync(sourceEvidenceDir, { recursive: true, force: true });
        fs.rmSync(restoredEvidenceDir, { recursive: true, force: true });
        fs.mkdirSync(sourceEvidenceDir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.mkdirSync(restoredEvidenceDir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename

        const user = await User.create({
            name: 'Operador Sintetico',
            username: 'operador.sintetico',
            email: 'operador.sintetico@example.test',
            password: 'hash-nao-exposto-em-inventario',
            role: 'admin'
        });
        const project = await Project.create({ title: 'Projeto Inventario' });
        const demanda = await Demanda.create({
            demandaId: 'INV1',
            nome: 'Demanda Ativa',
            project: project._id,
            evidences: [{
                filename: '1700-abcd-prova.txt',
                originalName: 'prova.txt',
                mimetype: 'text/plain',
                size: 16
            }]
        });
        await Scenario.create({
            title: 'Cenário Inventario',
            description: 'Descrição sintética',
            steps: ['Passo 1'],
            expectedResult: 'Ok',
            demanda: demanda._id
        });
        await SystemConfig.create({
            key: 'email_settings',
            value: { host: 'smtp.example.test', port: 587, user: 'mailer', pass: 'segredo-nao-vazar' }
        });
        await CascadeDeletionJob.create({
            targetType: 'Demanda',
            targetId: new mongoose.Types.ObjectId(),
            requestedBy: user._id,
            status: 'failed',
            phase: 'deleting_demandas',
            failedPhase: 'deleting_demandas',
            retentionState: 'retained',
            retainedAttachments: [{
                relativeDir: 'RET1_Demanda_Retida',
                filename: '1700-efgh-retida.txt',
                originalName: 'retida.txt',
                size: 14
            }]
        });

        const activeDir = path.join(sourceEvidenceDir, 'INV1_Demanda_Ativa');
        const retainedDir = path.join(sourceEvidenceDir, 'RET1_Demanda_Retida');
        fs.mkdirSync(activeDir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.mkdirSync(retainedDir, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename
        const activeFile = path.join(activeDir, '1700-abcd-prova.txt');
        const retainedFile = path.join(retainedDir, '1700-efgh-retida.txt');
        fs.writeFileSync(activeFile, 'evidencia-ativa!'); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.writeFileSync(retainedFile, 'anexo-retido!!'); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.chmodSync(activeFile, 0o640); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.chmodSync(retainedFile, 0o600); // eslint-disable-line security/detect-non-literal-fs-filename

        // Replica idêntica preservando conteúdo e permissões para simular restauração íntegra.
        fs.cpSync(sourceEvidenceDir, restoredEvidenceDir, { recursive: true, preserveTimestamps: true });
        fs.chmodSync(path.join(restoredEvidenceDir, 'INV1_Demanda_Ativa', '1700-abcd-prova.txt'), 0o640); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.chmodSync(path.join(restoredEvidenceDir, 'RET1_Demanda_Retida', '1700-efgh-retida.txt'), 0o600); // eslint-disable-line security/detect-non-literal-fs-filename
    };

    test('inventário une documentos, anexos com checksum/permissões, configurações sem segredos e versão', async () => {
        await seedState();

        const inventory = await buildInventory({
            db: mongoose.connection.db,
            evidenceBaseDir: sourceEvidenceDir,
            allowlistPath,
            versionPath,
            packageJsonPath
        });

        assert.equal(inventory.version.appVersion, '1.0.1');
        assert.equal(inventory.version.backendPackageVersion, '1.0.1');
        assert.equal(inventory.configurations.allowlist.exists, true);
        assert.deepEqual(inventory.configurations.allowlist.keys, ['mantis']);
        assert.equal(inventory.configurations.systemConfigs.length, 1);
        assert.equal(inventory.configurations.systemConfigs[0].key, 'email_settings');
        assert.equal(JSON.stringify(inventory).includes('segredo-nao-vazar'), false);

        assert.equal(inventory.documents.collections.projects.count, 1);
        assert.equal(inventory.documents.collections.demandas.count, 1);
        assert.equal(inventory.documents.collections.scenarios.count, 1);
        assert.equal(inventory.documents.cascadeJobs.failedCount, 1);
        assert.equal(inventory.documents.cascadeJobs.retainedCount, 1);

        assert.equal(inventory.attachments.totalFiles, 2);
        const activeEntry = inventory.attachments.files.find((f) => f.relativePath === 'INV1_Demanda_Ativa/1700-abcd-prova.txt');
        assert.ok(activeEntry);
        assert.equal(activeEntry.mode, '0640');
        assert.match(activeEntry.sha256, /^[a-f0-9]{64}$/);

        assert.equal(inventory.links.activeLinkedCount, 1);
        assert.equal(inventory.links.missingActiveFiles.length, 0);
        assert.equal(inventory.links.retainedLinkedCount, 1);
        assert.equal(inventory.links.missingRetainedFiles.length, 0);
        assert.equal(inventory.links.orphanFiles.length, 0);
        assert.equal(inventory.links.brokenDemandas.length, 0);
        assert.equal(inventory.links.brokenScenarios.length, 0);
    });

    test('verificação aprova restauração íntegra e detecta perda de arquivo, corrupção de checksum e troca de permissão', async () => {
        await seedState();
        const opts = (dir) => ({
            db: mongoose.connection.db,
            evidenceBaseDir: dir,
            allowlistPath,
            versionPath,
            packageJsonPath
        });

        const expected = await buildInventory(opts(sourceEvidenceDir));
        const restoredOk = await buildInventory(opts(restoredEvidenceDir));
        const okReport = verifyRestoredInventory(expected, restoredOk);
        assert.equal(okReport.ok, true);
        assert.deepEqual(okReport.discrepancies, []);

        // 1. Alteração de permissão deve ser detectada.
        const activeRestored = path.join(restoredEvidenceDir, 'INV1_Demanda_Ativa', '1700-abcd-prova.txt');
        fs.chmodSync(activeRestored, 0o644); // eslint-disable-line security/detect-non-literal-fs-filename
        const permReport = verifyRestoredInventory(expected, await buildInventory(opts(restoredEvidenceDir)));
        assert.equal(permReport.ok, false);
        assert.equal(permReport.checks.permissionsMatch, false);
        assert.ok(permReport.discrepancies.some((item) => item.code === 'permission_mismatch'));

        // 2. Corrupção de conteúdo deve falhar no checksum.
        fs.chmodSync(activeRestored, 0o640); // eslint-disable-line security/detect-non-literal-fs-filename
        fs.writeFileSync(activeRestored, 'evidencia-alter!'); // eslint-disable-line security/detect-non-literal-fs-filename
        const checksumReport = verifyRestoredInventory(expected, await buildInventory(opts(restoredEvidenceDir)));
        assert.equal(checksumReport.ok, false);
        assert.equal(checksumReport.checks.attachmentsMatch, false);
        assert.ok(checksumReport.discrepancies.some((item) => item.code === 'checksum_mismatch'));

        // 3. Perda de arquivo deve acusar anexo ausente e vínculo quebrado.
        fs.unlinkSync(activeRestored); // eslint-disable-line security/detect-non-literal-fs-filename
        const missingReport = verifyRestoredInventory(expected, await buildInventory(opts(restoredEvidenceDir)));
        assert.equal(missingReport.ok, false);
        assert.equal(missingReport.checks.linksIntact, false);
        assert.ok(missingReport.discrepancies.some((item) => item.code === 'missing_attachment'));
        assert.ok(missingReport.discrepancies.some((item) => item.code === 'broken_link'));
    });
});
