/*
 * Propagation worker: rasterises the aperture and propagates it off the main thread.
 * Message in:  {id, spec, N, L, params}   (SI units; see shared/optics/propagation.js)
 * Message out: {id, ok: true, field: {re, im}, res: {re, im, n, dx, crop, power, bandLimit, method, pad}, ms}
 *              {id, ok: false, error}
 * The page terminates and respawns this worker to cancel an obsolete long-running job.
 */
/* global importScripts */
importScripts("../shared/optics/core.js", "../shared/optics/propagation.js");

const P = self.OpticsModels.propagation;

self.onmessage = (e) => {
    const {
        id,
        spec,
        N,
        L,
        params
    } = e.data;
    try {
        const t0 = performance.now();
        const grid = P.createGrid(N, L);
        const field = P.buildAperture(spec, grid);
        const res = P.propagate(field, grid, params);
        const ms = performance.now() - t0;
        self.postMessage({
            id,
            ok: true,
            ms,
            field: {
                re: field.re,
                im: field.im
            },
            res: {
                re: res.re,
                im: res.im,
                n: res.n,
                dx: res.dx,
                crop: res.crop,
                power: res.power,
                bandLimit: res.bandLimit,
                method: res.method,
                pad: res.pad
            }
        }, [field.re.buffer, field.im.buffer, res.re.buffer, res.im.buffer]);
    } catch (err) {
        self.postMessage({
            id,
            ok: false,
            error: String(err && err.message || err)
        });
    }
};