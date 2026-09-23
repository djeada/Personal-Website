const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("../../src/tools/shared/optics/ui.js");

test("niceTicks uses 1-2-5 steps and stays inside the range", () => {
    for (const [lo, hi, n] of [[0, 1, 5], [-3.2, 7.9, 5], [0, 0.0037, 4], [1e5, 3.3e5, 6], [-1, 1, 8], [400e-9, 700e-9, 5]]) {
        const t = ui.niceTicks(lo, hi, n);
        const mant = t.step / Math.pow(10, Math.floor(Math.log10(t.step) + 1e-12));
        assert.ok([1, 2, 5, 10].some((m) => Math.abs(mant - m) < 1e-9), `step ${t.step}`);
        assert.ok(t.length >= 2 && t.length <= 2 * n + 2, `count ${t.length} for ${lo}..${hi}`);
        for (const v of t) assert.ok(v >= lo - 1e-12 * Math.abs(hi) && v <= hi + 1e-12 * Math.abs(hi));
        for (let i = 1; i < t.length; i++) assert.ok(Math.abs(t[i] - t[i - 1] - t.step) < 1e-9 * t.step);
    }
    assert.deepEqual(Array.from(ui.niceTicks(0, 1, 5)), [0, 0.2, 0.4, 0.6, 0.8, 1]);
    assert.deepEqual(Array.from(ui.niceTicks(-10, 10, 4)), [-10, -5, 0, 5, 10]);
    assert.deepEqual(ui.logTicks(1e-4, 1), [1e-4, 1e-3, 1e-2, 0.1, 1]);
    assert.deepEqual(ui.logTicks(1, 100), [1, 2, 5, 10, 20, 50, 100]);
    assert.equal(ui.formatTick(0.25, 0.05), "0.25");
    assert.equal(ui.formatTick(-2, 1), "−2");
    assert.equal(ui.formatTick(2e-5, 1e-5), "2e−5");
});

test("colormaps: endpoints, monotone lightness for sequential, cyclic wrap, diverging centre", () => {
    const v = ui.colormap("viridis");
    assert.deepEqual(v.rgb(0), [0x44, 0x01, 0x54]);
    assert.deepEqual(v.rgb(1), [0xfd, 0xe7, 0x25]);
    assert.deepEqual(v.rgb(-3), v.rgb(0), "sequential clamps");
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    for (const name of ["viridis", "inferno", "gray"]) {
        const cm = ui.colormap(name);
        for (let i = 1; i <= 20; i++) assert.ok(lum(cm.rgb(i / 20)) >= lum(cm.rgb((i - 1) / 20)) - 1, `${name} monotone`);
    }
    const tw = ui.colormap("twilight");
    assert.equal(tw.kind, "cyclic");
    assert.deepEqual(tw.rgb(0), tw.rgb(1));
    assert.deepEqual(tw.rgb(1.25), tw.rgb(0.25), "cyclic wraps");
    assert.deepEqual(ui.colormap("hsv").rgb(0), ui.colormap("hsv").rgb(1));
    const d = ui.colormap("diverging");
    for (const c of d.rgb(0.5)) assert.ok(Math.abs(c - 0xf7) <= 2, "zero is white-ish");
    assert.ok(d.rgb(0)[2] > d.rgb(0)[0] && d.rgb(1)[0] > d.rgb(1)[2], "blue low, red high");
    assert.throws(() => ui.colormap("nope"), RangeError);
    for (const n of ui.colormapNames) assert.equal(ui.colormap(n).lut.length, 768);
});

test("makeNorm handles linear, log and floors", () => {
    const n = ui.makeNorm({}, -2, 2);
    assert.equal(n.t(0), 0.5);
    const l = ui.makeNorm({ log: true, max: 1, floor: 1e-3 }, 0, 1);
    assert.equal(l.t(1), 1);
    assert.ok(Math.abs(l.t(1e-3)) < 1e-12);
    assert.ok(Math.abs(l.t(0.0316227766) - 0.5) < 1e-9);
    assert.equal(l.t(0), 0, "zero maps to the floor colour, not NaN");
});

test("wavelengthToRGB: visible colours and dark outside 380–780 nm", () => {
    assert.deepEqual(ui.wavelengthToRGB(300), [0, 0, 0]);
    assert.deepEqual(ui.wavelengthToRGB(900), [0, 0, 0]);
    const g = ui.wavelengthToRGB(532), r = ui.wavelengthToRGB(650), b = ui.wavelengthToRGB(450);
    assert.ok(g[1] === 255 && g[2] === 0);
    assert.ok(r[0] === 255 && r[1] === 0);
    assert.ok(b[2] === 255 && b[0] === 0);
});

test("state encode/decode round-trips with template types; CSV quoting", () => {
    const state = { lambda: 6.33e-7, n: 1.5, show: true, mode: "s pol", layers: [{ n: 1.38, d: 1e-7 }] };
    const s = ui.encodeState(state);
    const back = ui.decodeState("?" + s, { lambda: 0, n: 0, show: false, mode: "", layers: [] });
    assert.deepEqual(back, state);
    // unknown keys and malformed numbers are ignored
    assert.deepEqual(ui.decodeState("#n=abc&zzz=1&show=0", { n: 1, show: true }), { show: false });
    assert.equal(ui.csvString(["x (m)", "I"], [[1e-3, 0.5], ["a,b", 'q"t']]),
        'x (m),I\r\n0.001,0.5\r\n"a,b","q""t"\r\n');
});

test("interpAt interpolates and returns NaN outside", () => {
    const xs = [0, 1, 2], ys = [0, 10, 0];
    assert.equal(ui.interpAt(xs, ys, 0.5), 5);
    assert.equal(ui.interpAt(xs, ys, 1.5), 5);
    assert.ok(Number.isNaN(ui.interpAt(xs, ys, 3)));
});
