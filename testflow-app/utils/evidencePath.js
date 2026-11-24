const path = require('path');

// Caminho de um arquivo de evidência dentro da pasta da demanda, ou null se o nome tentar sair dela.
const resolveEvidenceFile = (evidenceDir, filename) => {
    if (typeof filename !== 'string' || filename === '' || filename.includes('\0')) return null;
    if (path.basename(filename) !== filename || filename.includes('\\') || filename === '..' || filename === '.') return null;
    return path.join(evidenceDir, filename);
};

// Pasta imediata dentro da raiz de evidências, ou null se o segmento tentar sair da raiz.
const resolveEvidenceSubdir = (baseDir, relativeDir) => {
    if (typeof baseDir !== 'string' || baseDir === '') return null;
    if (typeof relativeDir !== 'string' || relativeDir === '' || relativeDir.includes('\0')) return null;
    if (path.basename(relativeDir) !== relativeDir || relativeDir.includes('\\') || relativeDir === '..' || relativeDir === '.') return null;
    return path.join(baseDir, relativeDir);
};

// Pastas candidatas de uma demanda na ordem usada pelo servidor (formato legível atual e legado por ID).
const candidateEvidenceDirsForDemanda = (demanda) => {
    const dirs = [];
    if (demanda && demanda.demandaId && demanda.nome) {
        const safeFriendlyId = String(demanda.demandaId).replace(/[^a-zA-Z0-9]/g, '');
        const safeName = String(demanda.nome).replace(/\0/g, '').replace(/[^a-zA-Z0-9.\-_ \u00C0-\u00FF]/g, '').trim().replace(/\s+/g, '_');
        const friendly = `${safeFriendlyId}_${safeName}`;
        if (friendly && path.basename(friendly) === friendly && friendly !== '.' && friendly !== '..') {
            dirs.push(friendly);
        }
    }
    if (demanda && demanda._id) {
        const idStr = String(demanda._id);
        if (/^[a-fA-F0-9]{24}$/.test(idStr) && !dirs.includes(idStr)) {
            dirs.push(idStr);
        }
    }
    return dirs;
};

module.exports = {
    candidateEvidenceDirsForDemanda,
    resolveEvidenceFile,
    resolveEvidenceSubdir
};
