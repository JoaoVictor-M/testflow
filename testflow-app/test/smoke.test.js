const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const mongoose = require('mongoose');
const User = require('../models/User');

// Run only against the disposable MongoDB, on an isolated Docker network where
// its alias is mongodb-service, using a database reserved for this smoke test.
test('backend modules, persistence and authenticated HTTP work with the updated dependencies', { timeout: 45000 }, async (t) => {
    require('../models/AuditLog');
    require('../models/Demanda');
    require('../models/PendingEmail');
    require('../models/Project');
    require('../models/Responsavel');
    require('../models/Scenario');
    require('../models/Server');
    require('../models/SystemConfig');
    require('../models/Tag');
    require('../models/Version');
    require('../middleware/authMiddleware');
    require('../middleware/roleMiddleware');
    require('../services/auditService');
    require('../services/emailService');
    require('../utils/passwordUtils');

    const mongoUri = 'mongodb://mongodb-service:27017/testflow-smoke';
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    let user;
    t.after(async () => {
        try {
            if (user) {
                const result = await User.deleteOne({ _id: user._id });
                assert.equal(result.deletedCount, 1);
            }
        } finally {
            await mongoose.disconnect();
        }
    });
    const password = randomBytes(24).toString('hex');
    user = await User.create({
        name: 'Smoke Test', username: 'dependency-smoke',
        email: 'smoke@example.test', password, role: 'admin'
    });
    assert.notEqual(user.password, password);
    assert.equal(await user.comparePassword(password), true);
    assert.equal(await user.comparePassword('wrong-password'), false);

    const server = spawn(process.execPath, ['server.js'], {
        cwd: require('node:path').join(__dirname, '..'),
        env: { ...process.env, MONGO_URI: mongoUri, JWT_SECRET: randomBytes(32).toString('hex') },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    t.after(async () => {
        if (server.exitCode === null && server.signalCode === null) {
            const closed = once(server, 'exit');
            server.kill('SIGTERM');
            await closed;
        }
    });
    let connected = false;
    let output = '';
    server.stdout.on('data', (chunk) => {
        output += chunk.toString();
        connected = output.includes('Conexão com o MongoDB estabelecida');
    });
    server.stderr.on('data', () => {});
    for (let attempt = 0; !connected && attempt < 100; attempt += 1) {
        assert.equal(server.exitCode, null, 'backend exited before connecting');
        await delay(100);
    }
    assert.equal(connected, true, 'backend must connect to MongoDB');

    const base = 'http://127.0.0.1:3000';
    const denied = await fetch(`${base}/api/projects`);
    assert.equal(denied.status, 401);
    const login = await fetch(`${base}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, password })
    });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    assert.equal(typeof token, 'string');
    const projects = await fetch(`${base}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(projects.status, 200);
    assert.deepEqual(await projects.json(), []);

    const ready = await fetch(`${base}/ready`);
    assert.equal(ready.status, 200);

    // Todo o log do processo é JSON, com o id de requisição, e nada sensível vazou nele.
    const entries = output.trim().split('\n').map((line) => JSON.parse(line));
    const requests = entries.filter((entry) => entry.msg === 'requisição concluída');
    assert.ok(requests.length >= 3, 'cada requisição é registrada');
    assert.ok(requests.every((entry) => typeof entry.requestId === 'string'));
    for (const secret of [password, token, user.email]) {
        assert.equal(output.includes(secret), false, 'o log não pode conter senha, token nem e-mail');
    }
});
