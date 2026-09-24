(function(root, factory) {
    const m = factory();
    if (typeof module === "object" && module.exports) module.exports = m;
    else {
        root.OpticsModels = root.OpticsModels || {};
        root.OpticsModels.diffraction = m;
    }
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const core = (typeof require === "function" && typeof module === "object") ?
        require("./core.js") :
        self.OpticsModels.core;


    const besselJ1 = (x) => (Number.isFinite(x) ? core.besselJ1(x) : 0);


    const zeroCache = [];

    function besselJ1Zero(k) {
        if (!(k >= 1) || Math.floor(k) !== k) throw new RangeError("k must be a positive integer");
        if (!zeroCache[k]) zeroCache[k] = core.besselJZero(1, k);
        return zeroCache[k];
    }


    function sinc2(beta) {
        if (Math.abs(beta) < 1e-8) return 1 - beta * beta / 3;
        const s = Math.sin(beta) / beta;
        return s * s;
    }


    function airy(u) {
        if (Math.abs(u) < 1e-8) return 1 - u * u / 4;
        const v = 2 * besselJ1(u) / u;
        return v * v;
    }


    function sinThetaFromY(y, L) {
        return y / Math.hypot(y, L);
    }


    function yFromSinTheta(s, L) {
        if (Math.abs(s) >= 1) return Math.sign(s) * Infinity;
        return L * s / Math.sqrt(1 - s * s);
    }


    function slitIntensity(sinTheta, a, lambda) {
        return sinc2(Math.PI * a * sinTheta / lambda);
    }


    function circularIntensity(sinTheta, D, lambda) {
        return airy(Math.PI * D * sinTheta / lambda);
    }


    function intensityAt(r, params) {
        const s = sinThetaFromY(r, params.L);
        return params.type === "circular" ?
            circularIntensity(s, params.size, params.lambda) :
            slitIntensity(s, params.size, params.lambda);
    }


    function minima(params, count) {
        const out = [];
        for (let m = 1; m <= count; m++) {
            const s = params.type === "circular" ?
                besselJ1Zero(m) * params.lambda / (Math.PI * params.size) :
                m * params.lambda / params.size;
            if (s >= 1) break;
            out.push({
                order: m,
                sinTheta: s,
                theta: Math.asin(s),
                y: yFromSinTheta(s, params.L)
            });
        }
        return out;
    }


    function firstMinimum(params) {
        const list = minima(params, 1);
        return list.length ? list[0].y : Infinity;
    }


    function fresnelNumber(size, lambda, L) {
        const b = size / 2;
        return (b * b) / (lambda * L);
    }

    function regime(nf) {
        if (nf < 0.1) return "fraunhofer";
        if (nf < 1) return "marginal";
        return "fresnel";
    }


    function displayValue(I, scale, decades) {
        const v = Math.max(0, Math.min(1, I));
        if (scale !== "log") return v;
        const d = decades > 0 ? decades : 4;
        const floor = Math.pow(10, -d);
        if (v <= floor) return 0;
        return 1 + Math.log10(v) / d;
    }


    function smallAngleMinimum(params, m) {
        const k = params.type === "circular" ? besselJ1Zero(m) / Math.PI : m;
        return k * params.lambda * params.L / params.size;
    }


    function sineIntegral(x) {
        if (!Number.isFinite(x)) return Math.sign(x) * Math.PI / 2;
        const ax = Math.abs(x);
        let r;
        if (ax <= 20) {

            let term = ax,
                sum = ax;
            for (let k = 1; k < 200; k++) {
                term *= -ax * ax / ((2 * k) * (2 * k + 1));
                const add = term / (2 * k + 1);
                sum += add;
                if (Math.abs(add) < 1e-18 * Math.abs(sum)) break;
            }
            r = sum;
        } else {

            let f = 0,
                g = 0,
                tf = 1,
                tg = 1,
                prev = Infinity;
            for (let k = 0; k < 40; k++) {
                if (k > 0) {
                    tf *= -(2 * k - 1) * (2 * k) / (ax * ax);
                    tg *= -(2 * k) * (2 * k + 1) / (ax * ax);
                }
                const mag = Math.abs(tf);
                if (mag > prev) break;
                prev = mag;
                f += tf;
                g += tg;
                if (mag < 1e-17) break;
            }
            f /= ax;
            g /= ax * ax;
            r = Math.PI / 2 - f * Math.cos(ax) - g * Math.sin(ax);
        }
        return x < 0 ? -r : r;
    }


    function enclosedPower(params, Y) {
        if (!(Y > 0)) return 0;
        if (!Number.isFinite(Y)) return 1;
        const s = sinThetaFromY(Y, params.L);
        const x = Math.PI * params.size * s / params.lambda;
        if (params.type === "circular") {
            const j0 = core.besselJ0(x),
                j1 = core.besselJ1(x);
            return Math.min(1, Math.max(0, 1 - j0 * j0 - j1 * j1));
        }
        const sb = Math.sin(x);
        const tail = x < 1e-8 ? x : sb * sb / x;
        return Math.min(1, Math.max(0, (2 / Math.PI) * (sineIntegral(2 * x) - tail)));
    }


    function centralLobeFraction(type) {
        if (type === "circular") {
            const j0 = core.besselJ0(besselJ1Zero(1));
            return 1 - j0 * j0;
        }
        return (2 / Math.PI) * sineIntegral(2 * Math.PI);
    }


    function peakValue(params, norm, Iinc) {
        const {
            size,
            lambda,
            L
        } = params;
        const circ = params.type === "circular";
        const A = circ ? Math.PI * size * size / 4 : size;
        const perPower = circ ? A / (lambda * lambda * L * L) : A / (lambda * L);
        if (norm === "power") return perPower;
        if (norm === "absolute") return (Iinc > 0 ? Iinc : 0) * A * perPower;
        return 1;
    }


    function transmittedPower(params, Iinc) {
        const A = params.type === "circular" ? Math.PI * params.size * params.size / 4 : params.size;
        return Iinc * A;
    }


    function lineCut(params, R, n) {
        const ys = new Float64Array(n),
            I = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            const y = -R + (2 * R * i) / (n - 1);
            ys[i] = y;
            I[i] = intensityAt(Math.abs(y), params);
        }
        return {
            ys,
            I
        };
    }


    function detectorImage(params, R, n) {
        const out = new Float64Array(n * n);
        const d = (2 * R) / n;
        const circ = params.type === "circular";
        const cache = new Float64Array(n);
        for (let ix = 0; ix < n; ix++) cache[ix] = intensityAt(Math.abs(-R + (ix + 0.5) * d), params);
        for (let iy = 0; iy < n; iy++) {
            const y = -R + (iy + 0.5) * d;
            for (let ix = 0; ix < n; ix++) {
                out[iy * n + ix] = circ ? intensityAt(Math.hypot(-R + (ix + 0.5) * d, y), params) : cache[ix];
            }
        }
        return out;
    }

    return {
        besselJ1,
        besselJ1Zero,
        sinc2,
        airy,
        sinThetaFromY,
        yFromSinTheta,
        slitIntensity,
        circularIntensity,
        intensityAt,
        minima,
        firstMinimum,
        fresnelNumber,
        regime,
        displayValue,
        smallAngleMinimum,
        sineIntegral,
        enclosedPower,
        centralLobeFraction,
        peakValue,
        transmittedPower,
        lineCut,
        detectorImage,
    };
});