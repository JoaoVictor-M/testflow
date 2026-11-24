const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { createLogger, runWithRequestId } = require('../utils/logger');

const capture = () => {
    const lines = [];
    return { lines, log: createLogger((line) => lines.push(line)) };
};

describe('logger', () => {
    test('escreve uma linha JSON com hora, nível e mensagem', () => {
        const { lines, log } = capture();

        log.info('servidor iniciado', { port: 3000 });

        assert.equal(lines.length, 1);
        assert.ok(lines[0].endsWith('\n'));
        const entry = JSON.parse(lines[0]);
        assert.equal(entry.level, 'info');
        assert.equal(entry.msg, 'servidor iniciado');
        assert.equal(entry.port, 3000);
        assert.equal(new Date(entry.time).toISOString(), entry.time);
    });

    test('inclui o id da requisição em curso, inclusive depois de esperas assíncronas', async () => {
        const { lines, log } = capture();

        await runWithRequestId('req-1234', async () => {
            await new Promise((resolve) => setImmediate(resolve));
            log.warn('algo aconteceu');
        });
        log.warn('fora da requisição');

        assert.equal(JSON.parse(lines[0]).requestId, 'req-1234');
        assert.equal('requestId' in JSON.parse(lines[1]), false);
    });

    test('um campo não sobrescreve hora, nível nem mensagem', () => {
        const { lines, log } = capture();

        log.error('falha real', { level: 'debug', msg: 'outra', time: 'ontem' });

        const entry = JSON.parse(lines[0]);
        assert.equal(entry.level, 'error');
        assert.equal(entry.msg, 'falha real');
        assert.notEqual(entry.time, 'ontem');
    });

    test('oculta valores de campos sensíveis em qualquer profundidade', () => {
        const { lines, log } = capture();

        log.info('entrada', {
            password: 'segredo-1', user: { token: 'jwt-2', Authorization: 'Bearer jwt-3', email: 'a@b.test', name: 'ok' },
            list: [{ resetPasswordToken: 'reset-4' }],
        });

        const entry = JSON.parse(lines[0]);
        assert.equal(entry.password, '[redacted]');
        assert.deepEqual(entry.user, { token: '[redacted]', Authorization: '[redacted]', email: '[redacted]', name: 'ok' });
        assert.deepEqual(entry.list, [{ resetPasswordToken: '[redacted]' }]);
        for (const secret of ['segredo-1', 'jwt-2', 'jwt-3', 'a@b.test', 'reset-4']) {
            assert.equal(lines[0].includes(secret), false, `${secret} não pode aparecer`);
        }
    });

    test('troca e-mails dentro de textos e não falha com referência circular', () => {
        const { lines, log } = capture();
        const circular = { name: 'volta' };
        circular.self = circular;

        log.info('convite para maria.silva@example.test enviado', { detail: 'falhou para joao@example.test', circular });

        const entry = JSON.parse(lines[0]);
        assert.equal(entry.msg, 'convite para [email] enviado');
        assert.equal(entry.detail, 'falhou para [email]');
        assert.equal(entry.circular.name, 'volta');
    });

    test('um erro vira nome, código e pontos da pilha, sem a mensagem', () => {
        const { lines, log } = capture();
        const error = Object.assign(new Error('E11000 dup key: { email: "x@y.test" } senha=abc'), { code: 11000 });

        log.error('falha ao salvar', { err: error });

        const { err } = JSON.parse(lines[0]);
        assert.equal(err.name, 'Error');
        assert.equal(err.code, 11000);
        assert.ok(err.stack.every((frame) => frame.startsWith('at ')));
        assert.equal(lines[0].includes('x@y.test'), false);
        assert.equal(lines[0].includes('senha=abc'), false);
    });
});
