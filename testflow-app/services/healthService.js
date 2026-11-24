const mongoose = require('mongoose');

const PING_TIMEOUT_MS = 2000;

// O Mongo está pronto quando há conexão e ele responde a um ping dentro do prazo
// (menor que o timeout do HEALTHCHECK do container).
const isDatabaseReady = async (timeoutMs = PING_TIMEOUT_MS) => {
    if (mongoose.connection.readyState !== 1) return false;
    let timer;
    const expired = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('ping expirou')), timeoutMs); });
    try {
        await Promise.race([mongoose.connection.db.admin().ping(), expired]);
        return true;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
};

module.exports = { isDatabaseReady };
