const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
    candidateEvidenceDirsForDemanda,
    resolveEvidenceFile,
    resolveEvidenceSubdir
} = require('../utils/evidencePath');

const canonicalize = (value) => {
    if (value === null || value === undefined) return value;
    if (value instanceof Date) return { $date: value.toISOString() };
    if (Buffer.isBuffer(value)) return { $base64: value.toString('base64') };
    if (typeof value === 'object' && typeof value.toHexString === 'function') {
        return { $oid: value.toHexString() };
    }
    if (Array.isArray(value)) return value.map(canonicalize);
    if (typeof value === 'object') {
        const sorted = {};
        for (const key of Object.keys(value).sort()) {
            sorted[key] = canonicalize(value[key]);
        }
        return sorted;
    }
    return value;
};

const sha256Text = (text) => crypto.createHash('sha256').update(text).digest('hex');

const sha256File = (filePath) =>
    crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex'); // eslint-disable-line security/detect-non-literal-fs-filename

const readVersionInfo = (versionPath, packageJsonPath) => {
    let appVersion = '';
    if (versionPath && fs.existsSync(versionPath)) { // eslint-disable-line security/detect-non-literal-fs-filename
        appVersion = fs.readFileSync(versionPath, 'utf8').trim(); // eslint-disable-line security/detect-non-literal-fs-filename
    }
    let backendPackageVersion = '';
    if (packageJsonPath && fs.existsSync(packageJsonPath)) { // eslint-disable-line security/detect-non-literal-fs-filename
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')); // eslint-disable-line security/detect-non-literal-fs-filename
        backendPackageVersion = String(pkg.version || '');
    }
    return { appVersion, backendPackageVersion };
};

const readAllowlistInfo = (allowlistPath) => {
    if (!allowlistPath || !fs.existsSync(allowlistPath)) { // eslint-disable-line security/detect-non-literal-fs-filename
        return { exists: false, sha256: '', entriesCount: 0, keys: [] };
    }
    const raw = fs.readFileSync(allowlistPath, 'utf8'); // eslint-disable-line security/detect-non-literal-fs-filename
    const parsed = JSON.parse(raw);
    const keys = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? Object.keys(parsed).sort()
        : [];
    return {
        exists: true,
        sha256: sha256Text(JSON.stringify(canonicalize(parsed))),
        entriesCount: keys.length,
        keys
    };
};

const scanEvidenceFiles = (evidenceBaseDir) => {
    const files = [];
    let totalBytes = 0;
    if (!evidenceBaseDir || !fs.existsSync(evidenceBaseDir)) { // eslint-disable-line security/detect-non-literal-fs-filename
        return { totalFiles: 0, totalBytes: 0, files };
    }

    const rootResolved = path.resolve(evidenceBaseDir);
    const walk = (currentDir, prefix) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true }) // eslint-disable-line security/detect-non-literal-fs-filename
            .sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            const full = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(full, rel);
            } else if (entry.isFile()) {
                const stat = fs.lstatSync(full); // eslint-disable-line security/detect-non-literal-fs-filename
                const mode = `0${(stat.mode & 0o777).toString(8).padStart(3, '0')}`;
                files.push({
                    relativePath: rel,
                    size: stat.size,
                    mode,
                    sha256: sha256File(full)
                });
                totalBytes += stat.size;
            }
        }
    };

    walk(rootResolved, '');
    return { totalFiles: files.length, totalBytes, files };
};

const collectDatabaseInventory = async (db) => {
    const rawCollections = await db.listCollections().toArray();
    const names = rawCollections
        .map((item) => item.name)
        .filter((name) => !name.startsWith('system.'))
        .sort();

    const collections = {};
    for (const name of names) {
        const col = db.collection(name);
        const docs = await col.find({}).sort({ _id: 1 }).toArray();
        const rawIndexes = await col.indexes();
        const indexes = rawIndexes
            .map((idx) => ({
                name: idx.name,
                key: canonicalize(idx.key),
                unique: Boolean(idx.unique)
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
        collections[name] = {
            count: docs.length,
            digest: sha256Text(JSON.stringify(canonicalize(docs))),
            indexes
        };
    }

    const systemConfigDocs = names.includes('systemconfigs')
        ? await db.collection('systemconfigs').find({}).sort({ key: 1 }).toArray()
        : [];
    const systemConfigs = systemConfigDocs.map((doc) => ({
        key: String(doc.key || ''),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
        hasSecretValue: Boolean(doc.value && typeof doc.value === 'object' && doc.value.pass)
    }));

    const cascadeDocs = names.includes('cascadedeletionjobs')
        ? await db.collection('cascadedeletionjobs').find({}).sort({ _id: 1 }).toArray()
        : [];
    const cascadeJobs = {
        totalCount: cascadeDocs.length,
        pendingCount: cascadeDocs.filter((j) => j.status === 'pending' || j.status === 'in_progress').length,
        failedCount: cascadeDocs.filter((j) => j.status === 'failed').length,
        retainedCount: cascadeDocs.filter((j) => j.retentionState === 'retained').length,
        purgedCount: cascadeDocs.filter((j) => j.retentionState === 'purged').length
    };

    return { names, collections, systemConfigs, cascadeDocs, cascadeJobs };
};

const evaluateLinks = async (db, collectionNames, evidenceBaseDir, attachments, cascadeDocs) => {
    const rootResolved = evidenceBaseDir ? path.resolve(evidenceBaseDir) : '';
    const diskSet = new Set(attachments.files.map((item) => item.relativePath));
    const referencedSet = new Set();

    const projectDocs = collectionNames.includes('projects')
        ? await db.collection('projects').find({}, { projection: { _id: 1 } }).toArray()
        : [];
    const projectIds = new Set(projectDocs.map((doc) => String(doc._id)));

    const demandaDocs = collectionNames.includes('demandas')
        ? await db.collection('demandas').find({}).sort({ _id: 1 }).toArray()
        : [];
    const demandaIds = new Set(demandaDocs.map((doc) => String(doc._id)));

    const brokenDemandas = [];
    let activeLinkedCount = 0;
    const missingActiveFiles = [];

    for (const demanda of demandaDocs) {
        if (!projectIds.has(String(demanda.project))) {
            brokenDemandas.push(String(demanda._id));
        }
        const candidates = candidateEvidenceDirsForDemanda(demanda);
        const evidences = Array.isArray(demanda.evidences) ? demanda.evidences : [];
        for (const evidence of evidences) {
            if (!evidence || typeof evidence.filename !== 'string' || !evidence.filename) continue;
            let matchedRel = null;
            for (const dirName of candidates) {
                const subdir = resolveEvidenceSubdir(rootResolved, dirName);
                const full = subdir && resolveEvidenceFile(subdir, evidence.filename);
                if (!full) continue;
                const rel = `${dirName}/${evidence.filename}`;
                if (diskSet.has(rel)) {
                    matchedRel = rel;
                    break;
                }
            }
            if (matchedRel) {
                activeLinkedCount += 1;
                referencedSet.add(matchedRel);
            } else {
                missingActiveFiles.push({
                    demandaId: String(demanda._id),
                    filename: evidence.filename,
                    candidateDirs: candidates
                });
            }
        }
    }

    const scenarioDocs = collectionNames.includes('scenarios')
        ? await db.collection('scenarios').find({}, { projection: { _id: 1, demanda: 1 } }).toArray()
        : [];
    const brokenScenarios = scenarioDocs
        .filter((scenario) => !demandaIds.has(String(scenario.demanda)))
        .map((scenario) => String(scenario._id));

    let retainedLinkedCount = 0;
    const missingRetainedFiles = [];
    for (const job of cascadeDocs) {
        if (job.retentionState !== 'retained') continue;
        const retained = Array.isArray(job.retainedAttachments) ? job.retainedAttachments : [];
        for (const item of retained) {
            const subdir = resolveEvidenceSubdir(rootResolved, item.relativeDir);
            const full = subdir && resolveEvidenceFile(subdir, item.filename);
            const rel = full ? `${item.relativeDir}/${item.filename}` : null;
            if (rel && diskSet.has(rel)) {
                retainedLinkedCount += 1;
                referencedSet.add(rel);
            } else {
                missingRetainedFiles.push({
                    jobId: String(job._id),
                    relativeDir: item.relativeDir || '',
                    filename: item.filename || ''
                });
            }
        }
    }

    const orphanFiles = attachments.files
        .map((item) => item.relativePath)
        .filter((rel) => !referencedSet.has(rel));

    return {
        activeLinkedCount,
        missingActiveFiles,
        retainedLinkedCount,
        missingRetainedFiles,
        orphanFiles,
        brokenDemandas,
        brokenScenarios
    };
};

const buildInventory = async ({
    db,
    evidenceBaseDir,
    allowlistPath = path.resolve(__dirname, '..', 'config', 'allowlist.json'),
    versionPath = path.resolve(__dirname, '..', '..', 'VERSION'),
    packageJsonPath = path.resolve(__dirname, '..', 'package.json')
}) => {
    const generatedAt = new Date().toISOString();
    const version = readVersionInfo(versionPath, packageJsonPath);
    const allowlist = readAllowlistInfo(allowlistPath);
    const { names, collections, systemConfigs, cascadeDocs, cascadeJobs } = await collectDatabaseInventory(db);
    const attachments = scanEvidenceFiles(evidenceBaseDir);
    const links = await evaluateLinks(db, names, evidenceBaseDir, attachments, cascadeDocs);

    return {
        generatedAt,
        version,
        configurations: {
            allowlist,
            systemConfigs
        },
        documents: {
            collections,
            cascadeJobs
        },
        attachments,
        links
    };
};

const verifyRestoredInventory = (expected, restored) => {
    const discrepancies = [];

    const versionMatch = JSON.stringify(expected.version) === JSON.stringify(restored.version);
    if (!versionMatch) {
        discrepancies.push({ code: 'version_mismatch', detail: 'Versão da aplicação divergente' });
    }

    const configurationsMatch = JSON.stringify(expected.configurations) === JSON.stringify(restored.configurations);
    if (!configurationsMatch) {
        discrepancies.push({ code: 'config_mismatch', detail: 'Configurações divergentes' });
    }

    const documentsMatch = JSON.stringify(expected.documents.collections) === JSON.stringify(restored.documents.collections);
    if (!documentsMatch) {
        const allNames = new Set([
            ...Object.keys(expected.documents.collections || {}),
            ...Object.keys(restored.documents.collections || {})
        ]);
        const changed = [...allNames].sort().filter((name) =>
            JSON.stringify(expected.documents.collections?.[name]) !== JSON.stringify(restored.documents.collections?.[name])
        );
        discrepancies.push({ code: 'document_mismatch', detail: 'Coleções, documentos ou índices divergentes', collections: changed });
    }

    const expectedFiles = new Map(expected.attachments.files.map((item) => [item.relativePath, item]));
    const restoredFiles = new Map(restored.attachments.files.map((item) => [item.relativePath, item]));
    let attachmentsMatch = true;
    let permissionsMatch = true;

    for (const [rel, expectedFile] of expectedFiles.entries()) {
        const restoredFile = restoredFiles.get(rel);
        if (!restoredFile) {
            attachmentsMatch = false;
            discrepancies.push({ code: 'missing_attachment', path: rel });
            continue;
        }
        if (restoredFile.sha256 !== expectedFile.sha256 || restoredFile.size !== expectedFile.size) {
            attachmentsMatch = false;
            discrepancies.push({ code: 'checksum_mismatch', path: rel });
        }
        if (restoredFile.mode !== expectedFile.mode) {
            permissionsMatch = false;
            discrepancies.push({
                code: 'permission_mismatch',
                path: rel,
                expected: expectedFile.mode,
                actual: restoredFile.mode
            });
        }
    }

    for (const rel of restoredFiles.keys()) {
        if (!expectedFiles.has(rel)) {
            attachmentsMatch = false;
            discrepancies.push({ code: 'unexpected_attachment', path: rel });
        }
    }

    const linksIntact =
        restored.links.missingActiveFiles.length === 0 &&
        restored.links.missingRetainedFiles.length === 0 &&
        restored.links.brokenDemandas.length === 0 &&
        restored.links.brokenScenarios.length === 0;
    if (!linksIntact) {
        discrepancies.push({
            code: 'broken_link',
            missingActiveFiles: restored.links.missingActiveFiles.length,
            missingRetainedFiles: restored.links.missingRetainedFiles.length,
            brokenDemandas: restored.links.brokenDemandas.length,
            brokenScenarios: restored.links.brokenScenarios.length
        });
    }

    return {
        ok: discrepancies.length === 0,
        checks: {
            versionMatch,
            configurationsMatch,
            documentsMatch,
            attachmentsMatch,
            permissionsMatch,
            linksIntact
        },
        discrepancies
    };
};

module.exports = {
    buildInventory,
    verifyRestoredInventory
};
