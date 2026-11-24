const assert = require('node:assert/strict');
const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const tls = require('node:tls');
const SystemConfig = require('../models/SystemConfig');
const PendingEmail = require('../models/PendingEmail');

// Certificado autoassinado gerado na hora: nenhuma chave privada fica no repositório.
const selfSignedCertificate = () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'email-tls-'));
    try {
        execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
            '-subj', '/CN=smtp.invalid', '-keyout', path.join(directory, 'key.pem'),
            '-out', path.join(directory, 'cert.pem')], { stdio: 'ignore' });
        return {
            key: fs.readFileSync(path.join(directory, 'key.pem')),
            cert: fs.readFileSync(path.join(directory, 'cert.pem'))
        };
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
};

test('email service refuses an SMTP server whose certificate is not trusted', async (t) => {
    let completedHandshakes = 0;
    const server = tls.createServer(selfSignedCertificate(), (socket) => {
        completedHandshakes += 1;
        socket.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());

    const queued = [];
    t.mock.method(SystemConfig, 'findOne', async () => ({
        value: { host: '127.0.0.1', port: server.address().port, secure: true, from: 'sender@example.test' }
    }));
    t.mock.method(PendingEmail, 'create', async (email) => queued.push(email));
    t.mock.method(fs, 'appendFile', (_path, _message, callback) => callback(null));
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});

    const { sendResetPasswordEmail } = require('../services/emailService');
    await sendResetPasswordEmail('recipient@example.test', 'Test User', 'https://example.test/reset');

    assert.equal(completedHandshakes, 0);
    assert.equal(queued.length, 1);
    assert.match(queued[0].errorLog, /self.signed|certificate|altnames/i);
});
