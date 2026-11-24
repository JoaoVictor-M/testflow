const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const nodemailer = require('nodemailer');
const SystemConfig = require('../models/SystemConfig');
const PendingEmail = require('../models/PendingEmail');

test('email service sends invitations and resets with the upgraded mailer, and queues failures', async (t) => {
    const messages = [];
    const queued = [];
    const settings = {
        host: 'smtp.example.test', port: 587, secure: false,
        user: 'smtp-user', pass: 'fixture-only', from: 'sender@example.test'
    };
    t.mock.method(SystemConfig, 'findOne', async () => ({ value: settings }));
    t.mock.method(PendingEmail, 'create', async (email) => queued.push(email));
    t.mock.method(fs, 'appendFile', (_path, _message, callback) => callback(null));
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});

    const createTransport = nodemailer.createTransport.bind(nodemailer);
    let transport;
    t.mock.method(nodemailer, 'createTransport', (options, defaults) => {
        assert.equal(options.host, settings.host);
        assert.equal(options.port, settings.port);
        assert.equal(options.secure, settings.secure);
        assert.deepEqual(options.auth, { user: settings.user, pass: settings.pass });
        assert.equal(defaults.from, settings.from);
        // Compose real MIME messages without sending to an external SMTP server.
        transport = createTransport({ streamTransport: true, buffer: true }, defaults);
        const sendMail = transport.sendMail.bind(transport);
        t.mock.method(transport, 'sendMail', async (message) => {
            const result = await sendMail(message);
            messages.push({ message, result });
            return result;
        });
        return transport;
    });

    const { sendInviteEmail, sendResetPasswordEmail } = require('../services/emailService');
    await sendInviteEmail('recipient@example.test', 'tester', 'Test User', 'https://example.test/setup');
    await sendResetPasswordEmail('recipient@example.test', 'Test User', 'https://example.test/reset');

    assert.equal(messages.length, 2);
    assert.equal(queued.length, 0);
    for (const { message, result } of messages) {
        assert.deepEqual(result.envelope, {
            from: settings.from, to: ['recipient@example.test']
        });
        assert.ok(Buffer.isBuffer(result.message));
        assert.match(result.message.toString(), /Content-Type: text\/html/);
        assert.match(message.html, /https:\/\/example\.test\/(setup|reset)/);
    }

    t.mock.method(transport, 'sendMail', async () => {
        throw new Error('SMTP unavailable');
    });
    await sendResetPasswordEmail('recipient@example.test', 'Test User', 'https://example.test/reset');
    assert.equal(queued.length, 1);
    assert.equal(queued[0].status, 'pending');
    assert.equal(queued[0].type, 'reset');
    assert.equal(queued[0].errorLog, 'SMTP unavailable');
});
