import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement, useContext } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let server;

before(async () => {
    server = await createServer({
        server: { middlewareMode: true, watch: null },
        appType: 'custom',
        optimizeDeps: { noDiscovery: true, include: [] },
    });
    // Inicializa dependências compatíveis com SSR antes de simular preferências do navegador.
    await server.ssrLoadModule('/src/context/AuthProvider.jsx');
});

after(async () => {
    await server?.close();
});

function browserPreferences(t, savedTheme, systemDark = false) {
    globalThis.localStorage = {
        getItem: (key) => key === 'theme' ? savedTheme : 'stale-session',
    };
    globalThis.window = {
        matchMedia: () => ({ matches: systemDark }),
    };
    t.after(() => {
        delete globalThis.localStorage;
        delete globalThis.window;
    });
}

async function renderContext(name) {
    const contextModule = await server.ssrLoadModule(`/src/context/${name}Context.js`);
    const providerModule = await server.ssrLoadModule(`/src/context/${name}Provider.jsx`);
    let value;
    function Consumer() {
        value = useContext(contextModule[`${name}Context`]);
        return null;
    }
    renderToStaticMarkup(createElement(providerModule[`${name}Provider`], null, createElement(Consumer)));
    return value;
}

test('a fresh auth provider requires login even when a previous token is stored', async (t) => {
    browserPreferences(t, null);
    const value = await renderContext('Auth');
    assert.equal(value.user, null);
    assert.equal(value.loading, false);
});

for (const { name, saved, systemDark, expected } of [
    { name: 'saved preference', saved: 'light', systemDark: true, expected: 'light' },
    { name: 'dark system preference', saved: null, systemDark: true, expected: 'dark' },
    { name: 'light default', saved: null, systemDark: false, expected: 'light' },
]) {
    test(`the theme provider starts with the ${name}`, async (t) => {
        browserPreferences(t, saved, systemDark);
        const value = await renderContext('Theme');
        assert.equal(value.theme, expected);
    });
}
