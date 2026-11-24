// Run in Node 20 with the Docker Compose CLI (scripts/test/tools.Dockerfile); no Docker daemon is needed.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '../..');
const dockerfiles = ['testflow-app/Dockerfile', 'testflow-frontend/Dockerfile', 'nginx/Dockerfile'];

// Splits a Dockerfile into stages: { name, from, lines } with comments and blank lines dropped.
function stages(file) {
    const lines = fs.readFileSync(path.join(root, file), 'utf8').split('\n')
        .map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
    const result = [];
    for (const line of lines) {
        const from = line.match(/^FROM\s+(\S+)(?:\s+AS\s+(\S+))?/i);
        if (from) result.push({ from: from[1], name: from[2], lines: [] });
        else if (result.length) result.at(-1).lines.push(line);
    }
    return result;
}

function compose(...files) {
    const args = files.flatMap((file) => ['-f', file]);
    return JSON.parse(execFileSync('docker', ['compose', ...args, 'config', '--format', 'json'], {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, COMPOSE_PROJECT_NAME: 'testflow-config-test' },
    }));
}

const publishedPorts = (service) => (service.ports ?? []).map((port) => `${port.host_ip ?? ''}:${port.published}`);

for (const file of dockerfiles) {
    test(`${file} pins every base image by digest and ends in a non-root stage with a health check`, () => {
        const all = stages(file);
        const names = new Set(all.map((stage) => stage.name));
        for (const stage of all.filter((candidate) => !names.has(candidate.from))) {
            assert.match(stage.from, /@sha256:[0-9a-f]{64}$/, `${stage.from} must be pinned by digest`);
        }
        const last = all.at(-1);
        const user = last.lines.findLast((line) => line.startsWith('USER '));
        assert.ok(user, 'the final stage must set USER');
        assert.doesNotMatch(user, /^USER\s+(root|0)(:|$)/);
        assert.ok(last.lines.some((line) => line.startsWith('HEALTHCHECK ') && !line.includes('NONE')),
            'the final stage must have a HEALTHCHECK');
    });
}

for (const file of ['testflow-app/Dockerfile', 'testflow-frontend/Dockerfile']) {
    test(`${file} has dev and prod targets, prod last, and installs from the lock`, () => {
        const all = stages(file);
        assert.ok(all.some((stage) => stage.name === 'dev'), 'dev stage');
        assert.equal(all.at(-1).name, 'prod');
        const source = fs.readFileSync(path.join(root, file), 'utf8');
        assert.match(source, /npm ci/);
        assert.doesNotMatch(source, /npm install/);
        assert.doesNotMatch(source, /rm -f package-lock\.json/);
        const dev = all.find((stage) => stage.name === 'dev');
        assert.ok(dev.lines.some((line) => line.startsWith('HEALTHCHECK ')), 'dev stage health check');
    });
}

test('the back-end health checks ask /ready, so a container is healthy only with MongoDB answering', () => {
    for (const stage of stages('testflow-app/Dockerfile').filter((candidate) => ['dev', 'prod'].includes(candidate.name))) {
        assert.match(stage.lines.join('\n'), /HEALTHCHECK [^\n]*\\\n[^\n]*path: '\/ready'/, `${stage.name} stage health check`);
    }
});

test('production Compose publishes only the proxy, keeps the data volumes and waits for healthy services', () => {
    const { services, volumes } = compose('docker-compose.yml');
    assert.deepEqual(publishedPorts(services['nginx-service']).sort(), [':443', ':80']);
    for (const name of ['mongodb-service', 'backend-service', 'frontend-service']) {
        assert.equal(services[name].ports, undefined, `${name} must not publish a port`);
    }
    for (const [name, service] of Object.entries(services)) {
        assert.equal(service.container_name, undefined, `${name}: names come from the Compose project`);
    }
    assert.deepEqual(Object.keys(volumes), ['mongo-data']);
    assert.equal(volumes['mongo-data'].name, 'testflow-config-test_mongo-data', 'volume keeps the project-derived name');
    assert.ok(services['mongodb-service'].volumes.some((volume) => volume.source === 'mongo-data' && volume.target === '/data/db'));
    assert.ok(services['backend-service'].volumes.some((volume) => volume.target === '/evidencias_testes'
        && volume.source.endsWith('/evidencias_testes')));
    assert.ok(services['mongodb-service'].healthcheck);
    assert.equal(services['backend-service'].depends_on['mongodb-service'].condition, 'service_healthy');
    assert.equal(services['frontend-service'].depends_on['backend-service'].condition, 'service_healthy');
    assert.equal(services['nginx-service'].depends_on['frontend-service'].condition, 'service_healthy');
    assert.equal(services['nginx-service'].depends_on['backend-service'].condition, 'service_healthy');
});

test('development Compose builds the dev targets, publishes only to this machine and leaves nginx out', () => {
    const { services } = compose('docker-compose.yml', 'docker-compose.dev.yml');
    for (const name of ['backend-service', 'frontend-service']) {
        assert.equal(services[name].build.target, 'dev');
        assert.ok(services[name].volumes.some((volume) => volume.type === 'bind' && volume.target === '/app'));
    }
    assert.deepEqual(publishedPorts(services['backend-service']), ['127.0.0.1:3000']);
    assert.deepEqual(publishedPorts(services['frontend-service']), ['127.0.0.1:5173']);
    assert.equal(services['mongodb-service'].ports, undefined);
    assert.equal(services['nginx-service'], undefined);
    assert.ok(services['backend-service'].volumes.some((volume) => volume.target === '/evidencias_testes'));
});

test('test Compose is disposable: no published port, named volume, container name or secret', () => {
    const { services, volumes } = compose('docker-compose.teste.yml');
    assert.deepEqual(Object.keys(services).sort(), ['mailpit', 'mongodb-service']);
    assert.equal(volumes, undefined);
    for (const [name, service] of Object.entries(services)) {
        assert.equal(service.ports, undefined, `${name} must not publish a port`);
        assert.equal(service.container_name, undefined, `${name} must not fix its container name`);
        assert.ok(service.healthcheck, `${name} needs a health check for up --wait`);
        assert.match(service.image, /@sha256:[0-9a-f]{64}$/);
        for (const volume of service.volumes ?? []) assert.equal(volume.type, 'tmpfs');
    }
});

test('the old standalone MongoDB Compose, which published port 27017, is gone', () => {
    assert.equal(fs.existsSync(path.join(root, 'testflow-app/docker-compose.yml')), false);
});
