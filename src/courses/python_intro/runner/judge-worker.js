const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.29.5/full/';
const HARNESS_URL = new URL('judge_harness.py' + self.location.search, self.location.href).href;

let pyodide = null;

const ready = (async () => {
    self.importScripts(PYODIDE_URL + 'pyodide.js');
    const harness = fetch(HARNESS_URL).then((response) => {
        if (!response.ok) throw new Error('judge_harness.py: HTTP ' + response.status);
        return response.text();
    });
    const runtime = await self.loadPyodide({
        indexURL: PYODIDE_URL
    });
    runtime.runPython(await harness);
    pyodide = runtime;
})();

ready.then(
    () => self.postMessage({
        type: 'ready'
    }),
    (err) => self.postMessage({
        type: 'load-error',
        error: String((err && err.message) || err)
    })
);

self.addEventListener('message', async (event) => {
    const msg = event.data || {};
    if (msg.type !== 'run') return;
    try {
        await ready;
    } catch (err) {
        return;
    }
    self.postMessage({
        type: 'started',
        id: msg.id
    });
    let runner = null;
    try {
        runner = pyodide.globals.get('_pyk_run');
        const raw = runner(msg.code, JSON.stringify(msg.cases || []));
        self.postMessage({
            type: 'result',
            id: msg.id,
            result: JSON.parse(raw)
        });
    } catch (err) {
        self.postMessage({
            type: 'result',
            id: msg.id,
            crash: String((err && err.message) || err)
        });
    } finally {
        if (runner && runner.destroy) runner.destroy();
    }
});