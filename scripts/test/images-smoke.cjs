// Runs inside the disposable Compose backend with its generated certificate trusted.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');
const Demanda = require('./models/Demanda');

async function main() {
    assert.notEqual(process.getuid(), 0);
    const base = 'https://nginx-service:8443';
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            const response = await fetch(`${base}/api/projects`);
            ready = response.status === 401;
        } catch { /* Compose starts processes before they are ready. */ }
        if (ready) break;
        await delay(1000);
    }
    assert.equal(ready, true, 'HTTPS proxy must reach the authenticated backend');
    const page = await fetch(`${base}/testflow/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /<html/);
    assert.match(page.headers.get('strict-transport-security'), /max-age=/);
    for (const route of ['/', '/testflow']) {
        const navigation = await fetch(`${base}${route}`, { redirect: 'manual' });
        assert.equal(navigation.status, 301);
        assert.equal(navigation.headers.get('location'), '/testflow/');
    }
    const redirect = await fetch('http://nginx-service:8080/testflow/?a=1', {
        headers: { Host: 'attacker.example.test' }, redirect: 'manual'
    });
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.get('location'), 'https://canonical.example.test/testflow/?a=1');
    console.log('ok - HTTPS, frontend, authenticated proxy and trusted redirect');

    await mongoose.connect(process.env.MONGO_URI);
    try {
        const password = crypto.randomBytes(24).toString('hex');
        const username = `smoke-${crypto.randomBytes(8).toString('hex')}`;
        await User.create({ name: 'Image Smoke', username, email: `${username}@example.test`, password, role: 'admin' });
        const project = await Project.create({ title: 'Image smoke' });
        const demanda = await Demanda.create({ demandaId: 'SMOKE', nome: 'Evidence', project: project._id });
        const login = await fetch(`${base}/api/auth/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        assert.equal(login.status, 200);
        const { token } = await login.json();
        assert.equal(typeof token, 'string');
        const evidence = 'image smoke evidence\n';
        const form = new FormData();
        form.append('file', new Blob([evidence], { type: 'text/plain' }), 'smoke.txt');
        const uploaded = await fetch(`${base}/api/demandas/${demanda._id}/evidence`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form
        });
        assert.equal(uploaded.status, 201);
        const saved = await uploaded.json();
        assert.equal(saved.evidences.length, 1);
        assert.equal(saved.evidences[0].size, Buffer.byteLength(evidence));
        assert.equal(fs.readFileSync(`/evidencias_testes/SMOKE_Evidence/${saved.evidences[0].filename}`, 'utf8'), evidence);
        if (process.argv[2] === 'fresh') {
            assert.equal(fs.existsSync('/evidencias_testes/legacy'), false);
        } else {
            assert.equal(fs.readFileSync('/evidencias_testes/legacy/keep.txt', 'utf8'), 'existing evidence\n');
            assert.equal(fs.statSync('/evidencias_testes/legacy/keep.txt').mode & 0o777, 0o600);
        }
        const removed = await fetch(`${base}/api/demandas/${demanda._id}/evidence/${saved.evidences[0]._id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(removed.status, 200);
        assert.equal(fs.existsSync(`/evidencias_testes/SMOKE_Evidence/${saved.evidences[0].filename}`), false);
        console.log('ok - login and non-root upload/removal on fresh or migrated storage');
    } finally {
        await mongoose.disconnect();
    }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
