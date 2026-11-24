const { AsyncLocalStorage } = require('node:async_hooks');

const requestContext = new AsyncLocalStorage();

// Campos cujo valor nunca vai para o log, qualquer que seja o conteúdo.
const SENSITIVE_KEY = /pass|token|secret|authorization|cookie|e-?mail/i;
const EMAIL_IN_TEXT = /[^\s@<>"']+@[^\s@<>"']+/g;
const MAX_DEPTH = 5;
const MAX_STACK_FRAMES = 8;

// A mensagem de um erro pode trazer valores enviados pelo usuário (e-mail, trecho do corpo):
// o log guarda só o tipo, o código e os pontos da pilha.
const serializeError = (error) => ({
    name: error.name,
    code: error.code,
    stack: String(error.stack ?? '').split('\n').map((line) => line.trim())
        .filter((line) => line.startsWith('at ')).slice(0, MAX_STACK_FRAMES),
});

const sanitize = (value, depth = 0, seen = new WeakSet()) => {
    if (typeof value === 'string') return value.replace(EMAIL_IN_TEXT, '[email]');
    if (value instanceof Error) return serializeError(value);
    if (value === null || typeof value !== 'object') return value;
    if (seen.has(value) || depth >= MAX_DEPTH) return '[omitido]';
    seen.add(value);
    if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1, seen));
    return Object.fromEntries(Object.entries(value).map(([key, item]) =>
        [key, SENSITIVE_KEY.test(key) ? '[redacted]' : sanitize(item, depth + 1, seen)]));
};

const createLogger = (write) => {
    const log = (level) => (msg, fields = {}) => {
        const entry = { requestId: requestContext.getStore(), ...sanitize(fields), time: new Date().toISOString(), level, msg: sanitize(msg) };
        write(`${JSON.stringify(entry)}\n`);
    };
    return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
};

const runWithRequestId = (requestId, callback) => requestContext.run(requestId, callback);

module.exports = {
    logger: createLogger((line) => process.stdout.write(line)),
    createLogger,
    runWithRequestId,
};
