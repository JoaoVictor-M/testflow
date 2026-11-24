const crypto = require('crypto');
const mongoose = require('mongoose');
const RateLimitBucket = require('../models/RateLimitBucket');

const DEFAULTS = Object.freeze({
    windowMs: 15 * 60 * 1000,
    forgotIdentityMax: 5,
    forgotIpMax: 20,
    resetIpMax: 20,
    resetTokenMax: 10,
    trustProxyHops: 0
});

const RATE_LIMIT_MESSAGE = 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
const MAX_FALLBACK_ENTRIES = 1000;

const parsePositiveInt = (raw, fallback) => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseNonNegativeInt = (raw, fallback) => {
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const getRecoveryRateLimitConfig = (env = process.env) => ({
    windowMs: parsePositiveInt(env.RECOVERY_RATE_LIMIT_WINDOW_MS, DEFAULTS.windowMs),
    forgotIdentityMax: parsePositiveInt(env.RECOVERY_FORGOT_IDENTITY_MAX, DEFAULTS.forgotIdentityMax),
    forgotIpMax: parsePositiveInt(env.RECOVERY_FORGOT_IP_MAX, DEFAULTS.forgotIpMax),
    resetIpMax: parsePositiveInt(env.RECOVERY_RESET_IP_MAX, DEFAULTS.resetIpMax),
    resetTokenMax: parsePositiveInt(env.RECOVERY_RESET_TOKEN_MAX, DEFAULTS.resetTokenMax),
    trustProxyHops: parseNonNegativeInt(env.TRUST_PROXY_HOPS, DEFAULTS.trustProxyHops)
});

const getClientIp = (req, trustProxyHops = 0) => {
    if (trustProxyHops > 0) {
        const forwarded = req.headers?.['x-forwarded-for'];
        if (typeof forwarded === 'string' && forwarded.trim()) {
            const hops = forwarded.split(',').map((item) => item.trim()).filter(Boolean);
            if (hops.length > 0) {
                return hops[Math.max(0, hops.length - trustProxyHops)];
            }
        }
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
};

const hashKey = (scope, dimension, value) =>
    crypto.createHash('sha256').update(`${scope}:${dimension}:${value}`).digest('hex');

const consumeMongoBucket = async (key, windowMs, nowMs) => {
    const nowDate = new Date(nowMs);
    const nextResetAt = new Date(nowMs + windowMs);
    const expiredCondition = {
        $or: [
            { $eq: [{ $type: '$resetAt' }, 'missing'] },
            { $lte: ['$resetAt', nowDate] }
        ]
    };
    const updatePipeline = [
        {
            $set: {
                key,
                count: { $cond: [expiredCondition, 1, { $add: ['$count', 1] }] },
                resetAt: { $cond: [expiredCondition, nextResetAt, '$resetAt'] }
            }
        }
    ];

    try {
        return await RateLimitBucket.findOneAndUpdate({ key }, updatePipeline, { upsert: true, new: true }).lean();
    } catch (error) {
        if (error?.code === 11000) {
            return RateLimitBucket.findOneAndUpdate({ key }, updatePipeline, { new: true }).lean();
        }
        throw error;
    }
};

// shortcut: fallback em memória só atua sem Mongo conectado (ex.: testes isolados sem banco); com Mongo ativo usa estado compartilhado entre workers.
const consumeMemoryBucket = (memoryStore, key, windowMs, nowMs) => {
    if (memoryStore.size >= MAX_FALLBACK_ENTRIES) {
        for (const [storedKey, entry] of memoryStore.entries()) {
            if (entry.resetAtMs <= nowMs) {
                memoryStore.delete(storedKey);
            }
        }
    }

    const existing = memoryStore.get(key);
    if (!existing || existing.resetAtMs <= nowMs) {
        const fresh = { count: 1, resetAtMs: nowMs + windowMs };
        memoryStore.set(key, fresh);
        return { count: fresh.count, resetAt: new Date(fresh.resetAtMs) };
    }

    existing.count += 1;
    return { count: existing.count, resetAt: new Date(existing.resetAtMs) };
};

const createRateLimiter = ({ scope, getBuckets, windowMs, now = () => Date.now() }) => {
    const memoryStore = new Map();

    return async (req, res, next) => {
        try {
            const nowMs = now();
            const resolvedWindowMs = typeof windowMs === 'function' ? windowMs() : windowMs;
            const buckets = getBuckets(req);

            for (const bucket of buckets) {
                if (typeof bucket.value !== 'string' || bucket.value.length === 0) continue;
                const hashedKey = hashKey(scope, bucket.dimension, bucket.value);
                const result = mongoose.connection.readyState === 1
                    ? await consumeMongoBucket(hashedKey, resolvedWindowMs, nowMs)
                    : consumeMemoryBucket(memoryStore, hashedKey, resolvedWindowMs, nowMs);

                if (result.count > bucket.max) {
                    const retryAfterSeconds = Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - nowMs) / 1000));
                    res.set('Retry-After', String(retryAfterSeconds));
                    return res.status(429).json({
                        message: RATE_LIMIT_MESSAGE,
                        retryAfterSeconds
                    });
                }
            }

            return next();
        } catch (error) {
            return next(error);
        }
    };
};

const normalizeNonEmpty = (value, { lowercase = false } = {}) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    return lowercase ? trimmed.toLowerCase() : trimmed;
};

const forgotPasswordLimiter = createRateLimiter({
    scope: 'forgot-password',
    windowMs: () => getRecoveryRateLimitConfig().windowMs,
    getBuckets: (req) => {
        const config = getRecoveryRateLimitConfig();
        const username = normalizeNonEmpty(req.body?.username);
        const email = normalizeNonEmpty(req.body?.email, { lowercase: true });
        return [
            { dimension: 'username', value: username, max: config.forgotIdentityMax },
            { dimension: 'email', value: email, max: config.forgotIdentityMax },
            { dimension: 'ip', value: getClientIp(req, config.trustProxyHops), max: config.forgotIpMax }
        ];
    }
});

const validateResetTokenLimiter = createRateLimiter({
    scope: 'validate-reset-token',
    windowMs: () => getRecoveryRateLimitConfig().windowMs,
    getBuckets: (req) => {
        const config = getRecoveryRateLimitConfig();
        const token = normalizeNonEmpty(req.params?.token);
        return [
            { dimension: 'token', value: token, max: config.resetTokenMax },
            { dimension: 'ip', value: getClientIp(req, config.trustProxyHops), max: config.resetIpMax }
        ];
    }
});

const resetPasswordLimiter = createRateLimiter({
    scope: 'reset-password',
    windowMs: () => getRecoveryRateLimitConfig().windowMs,
    getBuckets: (req) => {
        const config = getRecoveryRateLimitConfig();
        const token = normalizeNonEmpty(req.body?.token);
        return [
            { dimension: 'token', value: token, max: config.resetTokenMax },
            { dimension: 'ip', value: getClientIp(req, config.trustProxyHops), max: config.resetIpMax }
        ];
    }
});

module.exports = {
    DEFAULTS,
    RATE_LIMIT_MESSAGE,
    createRateLimiter,
    getClientIp,
    getRecoveryRateLimitConfig,
    forgotPasswordLimiter,
    validateResetTokenLimiter,
    resetPasswordLimiter
};
