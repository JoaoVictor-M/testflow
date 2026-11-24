const assert = require('node:assert/strict');
const { test } = require('node:test');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const mongoose = require('mongoose');
const User = require('../models/User');

// Run only against the disposable MongoDB, on an isolated Docker network where
// its alias is mongodb-service (the server currently uses that fixed hostname).
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

    await mongoose.connect('mongodb://mongodb-service:27017/testflow-db', { serverSelectionTimeoutMS: 10000 });
    t.after(() => mongoose.disconnect());
    const password = randomBytes(24).toString('hex');
    const user = await User.create({
        name: 'Smoke Test', username: 'dependency-smoke',
        email: 'smoke@example.test', password, role: 'admin'
    });
    assert.notEqual(user.password, password);
    assert.equal(await user.comparePassword(password), true);
    assert.equal(await user.comparePassword('wrong-password'), false);

    const server = spawn(process.execPath, ['server.js'], {
        cwd: require('node:path').join(__dirname, '..'),
        env: { ...process.env, JWT_SECRET: randomBytes(32).toString('hex') },
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
        connected = output.includes('Conexão com o MongoDB (via Docker) estabelecida!');
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
});
