const path = require('path');

// Caminho de um arquivo de evidência dentro da pasta da demanda, ou null se o nome tentar sair dela.
const resolveEvidenceFile = (evidenceDir, filename) => {
    if (typeof filename !== 'string' || filename === '' || filename.includes('\0')) return null;
    if (path.basename(filename) !== filename || filename.includes('\\') || filename === '..' || filename === '.') return null;
    return path.join(evidenceDir, filename);
};

module.exports = { resolveEvidenceFile };
