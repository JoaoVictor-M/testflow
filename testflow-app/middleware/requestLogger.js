const { randomUUID } = require('node:crypto');
const { logger, runWithRequestId } = require('../utils/logger');

const VALID_REQUEST_ID = /^[\w.-]{8,64}$/;
// As sondas dos containers rodam a cada poucos segundos e só poluiriam o log.
const PROBES = new Set(['/health', '/ready']);

// Dá um id a cada requisição (o do proxy, se vier em formato seguro) e registra o fim dela. Registra
// o modelo da rota (/api/x/:token), nunca o caminho nem a query reais, que podem carregar segredos.
const requestLogger = (req, res, next) => {
    const incoming = req.get('x-request-id');
    const requestId = VALID_REQUEST_ID.test(incoming ?? '') ? incoming : randomUUID();
    const startedAt = process.hrtime.bigint();
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        if (PROBES.has(req.path)) return;
        logger.info('requisição concluída', {
            requestId,
            method: req.method,
            route: req.route ? `${req.baseUrl}${req.route.path}` : 'sem-rota',
            status: res.statusCode,
            durationMs: Number(process.hrtime.bigint() - startedAt) / 1e6,
        });
    });

    runWithRequestId(requestId, next);
};

module.exports = requestLogger;
