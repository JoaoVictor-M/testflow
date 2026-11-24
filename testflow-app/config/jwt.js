const dotenv = require('dotenv');

const MIN_JWT_SECRET_BYTES = 32;

let cachedSecret = null;
let dotenvLoaded = false;

const createConfigError = (message) => {
    const error = new Error(message);
    error.code = 'JWT_CONFIG_INVALID';
    return error;
};

const validateJwtSecret = (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw createConfigError('JWT_SECRET não configurado. Defina uma chave com pelo menos 32 bytes antes de iniciar o servidor.');
    }
    if (Buffer.byteLength(value.trim(), 'utf8') < MIN_JWT_SECRET_BYTES) {
        throw createConfigError(`JWT_SECRET inválido: a chave deve ter pelo menos ${MIN_JWT_SECRET_BYTES} bytes.`);
    }
    return value;
};

const getJwtSecret = () => {
    if (cachedSecret !== null) return cachedSecret;
    if (!dotenvLoaded) {
        dotenv.config({ quiet: true }); // o aviso do dotenv não é JSON
        dotenvLoaded = true;
    }
    cachedSecret = validateJwtSecret(process.env.JWT_SECRET);
    return cachedSecret;
};

module.exports = {
    MIN_JWT_SECRET_BYTES,
    getJwtSecret,
    validateJwtSecret,
};
