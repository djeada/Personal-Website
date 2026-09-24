const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

const HARNESS = String.raw`
import builtins
import io
import json
import linecache
import sys
import traceback

_PYK_MAX_OUTPUT = 20000


def _pyk_norm(text):
    text = str(text).replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines)


def _pyk_floats(text):
    tokens = text.split()
    try:
        return [float(token) for token in tokens]
    except ValueError:
        return None


def _pyk_same(output, expected):
    if output == expected:
        return True
    got, want = _pyk_floats(output), _pyk_floats(expected)
    if got is None or want is None or len(got) != len(want):
        return False
    return all(abs(a - b) <= 0.01 for a, b in zip(got, want))


def _pyk_error(exc):
    frames = [
        frame
        for frame in traceback.extract_tb(exc.__traceback__)
        if frame.filename == "main.py"
    ]
    line = frames[-1].lineno if frames else None
    if isinstance(exc, SyntaxError) and exc.filename == "main.py":
        line = exc.lineno
    text = "".join(traceback.format_list(frames))
    if text:
        text = "Traceback (most recent call last):\n" + text
    text += "".join(traceback.format_exception_only(type(exc), exc))
    return {
        "type": type(exc).__name__,
        "message": exc.msg if isinstance(exc, SyntaxError) else str(exc),
        "line": line,
        "traceback": text.rstrip(),
    }


def _pyk_case(compiled, case):
    stdin = io.StringIO(case.get("input") or "")
    stdout = io.StringIO()
    stderr = io.StringIO()

    def _input(prompt=""):
        line = stdin.readline()
        if not line:
            raise EOFError("EOF when reading a line")
        return line.rstrip("\r\n")

    saved = (sys.stdin, sys.stdout, sys.stderr, builtins.input)
    sys.stdin, sys.stdout, sys.stderr, builtins.input = stdin, stdout, stderr, _input
    error = None
    try:
        exec(compiled, {"__name__": "__main__", "__builtins__": builtins})
    except SystemExit:
        pass
    except BaseException as exc:
        error = _pyk_error(exc)
    finally:
        sys.stdin, sys.stdout, sys.stderr, builtins.input = saved

    output = stdout.getvalue()
    result = {
        "output": output[:_PYK_MAX_OUTPUT],
        "truncated": len(output) > _PYK_MAX_OUTPUT,
        "stderr": stderr.getvalue()[:_PYK_MAX_OUTPUT],
        "error": error,
    }
    if case.get("expected") is not None:
        result["ok"] = error is None and _pyk_same(
            _pyk_norm(output), _pyk_norm(case["expected"])
        )
    return result


def _pyk_run(code, cases_json):
    cases = json.loads(cases_json)
    linecache.cache["main.py"] = (len(code), None, code.splitlines(True), "main.py")
    try:
        compiled = compile(code, "main.py", "exec")
    except SyntaxError as exc:
        return json.dumps({"compile_error": _pyk_error(exc)})
    return json.dumps({"results": [_pyk_case(compiled, case) for case in cases]})
`;

let pyodide = null;

const ready = (async () => {
    self.importScripts(PYODIDE_URL + 'pyodide.js');
    pyodide = await self.loadPyodide({
        indexURL: PYODIDE_URL
    });
    pyodide.runPython(HARNESS);
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