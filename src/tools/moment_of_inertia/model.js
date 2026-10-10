(function(root) {
    "use strict";

    const SHAPES = {
        rod: { name: "Thin rod", dimensions: ["length"], kind: "line" },
        disk: { name: "Solid disk", dimensions: ["radius"], kind: "area" },
        hoop: { name: "Thin hoop", dimensions: ["radius"], kind: "line" },
        plate: { name: "Rectangular plate", dimensions: ["length", "width"], kind: "area" },
        cylinder: { name: "Solid cylinder", dimensions: ["radius", "height"], kind: "volume" },
        sphere: { name: "Solid sphere", dimensions: ["radius"], kind: "volume" }
    };
    const DEFAULTS = Object.freeze({
        shape: "disk", mass: 2, radius: 1, length: 2, width: 1, height: 2,
        tilt: 0, offset: 0, resolution: 8
    });

    function bounded(value, fallback, min, max) {
        return Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback;
    }

    function normalize(input = {}) {
        return {
            shape: Object.hasOwn(SHAPES, input.shape) ? input.shape : DEFAULTS.shape,
            mass: bounded(input.mass, DEFAULTS.mass, 0.2, 10),
            radius: bounded(input.radius, DEFAULTS.radius, 0.2, 2),
            length: bounded(input.length, DEFAULTS.length, 0.4, 4),
            width: bounded(input.width, DEFAULTS.width, 0.4, 4),
            height: bounded(input.height, DEFAULTS.height, 0.4, 4),
            tilt: bounded(input.tilt, DEFAULTS.tilt, 0, 90),
            offset: bounded(input.offset, DEFAULTS.offset, -2, 2),
            resolution: [4, 8, 16].includes(Number(input.resolution)) ? Number(input.resolution) : DEFAULTS.resolution
        };
    }

    // Body coordinates: rod along x, plate/disk/hoop in xy, cylinder along z.
    // n = (sin(beta), 0, cos(beta)); u is a perpendicular unit vector.
    // Moving the axis by d*u makes |d| the true perpendicular offset.
    function axis(config) {
        const beta = config.tilt * Math.PI / 180;
        const sin = config.tilt === 0 ? 0 : Math.sin(beta);
        const cos = config.tilt === 90 ? 0 : Math.cos(beta);
        return { n: [sin, 0, cos], u: [cos, 0, -sin], point: [config.offset * cos, 0, -config.offset * sin] };
    }

    function distanceSquared(point, config) {
        const { u } = axis(config);
        return (point.x * u[0] + point.z * u[2] - config.offset) ** 2 + point.y ** 2;
    }

    function principalMoments(config) {
        const { mass: m, radius: r, length: l, width: w, height: h } = config;
        switch (config.shape) {
            case "rod": return { x: 0, y: m * l * l / 12, z: m * l * l / 12 };
            case "disk": return { x: m * r * r / 4, y: m * r * r / 4, z: m * r * r / 2 };
            case "hoop": return { x: m * r * r / 2, y: m * r * r / 2, z: m * r * r };
            case "plate": return { x: m * w * w / 12, y: m * l * l / 12, z: m * (l * l + w * w) / 12 };
            case "cylinder": return { x: m * (3 * r * r + h * h) / 12, y: m * (3 * r * r + h * h) / 12, z: m * r * r / 2 };
            case "sphere": return { x: 2 * m * r * r / 5, y: 2 * m * r * r / 5, z: 2 * m * r * r / 5 };
        }
    }

    function analytic(config) {
        const p = principalMoments(config);
        const { n } = axis(config);
        const centered = p.x * n[0] ** 2 + p.z * n[2] ** 2;
        const shift = config.mass * config.offset ** 2;
        return { centered, shift, total: centered + shift, principal: p };
    }

    function density(config) {
        const { mass: m, radius: r, length: l, width: w, height: h } = config;
        switch (config.shape) {
            case "rod": return { symbol: "λ", value: m / l, unit: "kg/m" };
            case "hoop": return { symbol: "λ", value: m / (2 * Math.PI * r), unit: "kg/m" };
            case "disk": return { symbol: "σ", value: m / (Math.PI * r * r), unit: "kg/m²" };
            case "plate": return { symbol: "σ", value: m / (l * w), unit: "kg/m²" };
            case "cylinder": return { symbol: "ρ", value: m / (Math.PI * r * r * h), unit: "kg/m³" };
            case "sphere": return { symbol: "ρ", value: 3 * m / (4 * Math.PI * r ** 3), unit: "kg/m³" };
        }
    }

    function sample(config) {
        const { shape, mass, radius, length, width, height, resolution: n } = config;
        const points = [];
        const add = (x, y, z, weight) => points.push({ x, y, z, weight });
        const circularSlice = (z, r, sliceWeight, radialCount) => {
            for (let i = 0; i < radialCount; i++) {
                const a = r * i / radialCount, b = r * (i + 1) / radialCount;
                const midpoint = (a + b) / 2;
                const weight = sliceWeight * (b * b - a * a) / (r * r) / (2 * n);
                for (let j = 0; j < 2 * n; j++) {
                    const phi = 2 * Math.PI * (j + 0.5) / (2 * n);
                    add(midpoint * Math.cos(phi), midpoint * Math.sin(phi), z, weight);
                }
            }
        };
        switch (shape) {
            case "rod":
                for (let i = 0; i < n; i++) add(length * ((i + 0.5) / n - 0.5), 0, 0, 1 / n);
                break;
            case "hoop":
                for (let i = 0; i < 2 * n; i++) {
                    const phi = 2 * Math.PI * (i + 0.5) / (2 * n);
                    add(radius * Math.cos(phi), radius * Math.sin(phi), 0, 1 / (2 * n));
                }
                break;
            case "disk": circularSlice(0, radius, 1, n); break;
            case "plate":
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n; j++) add(length * ((i + 0.5) / n - 0.5), width * ((j + 0.5) / n - 0.5), 0, 1 / (n * n));
                }
                break;
            case "cylinder":
                for (let i = 0; i < n / 2; i++) circularSlice(height * ((i + 0.5) / (n / 2) - 0.5), radius, 1 / (n / 2), n);
                break;
            case "sphere":
                // Midpoint slices of a solid sphere, not points on a spherical shell.
                // Slice areas supply volume weights; normalize to preserve total mass.
                for (let i = 0; i < n; i++) {
                    const z = radius * (2 * (i + 0.5) / n - 1);
                    const r = Math.sqrt(radius * radius - z * z);
                    circularSlice(z, r, r * r * (2 * radius / n), n / 2);
                }
                break;
        }
        const sum = points.reduce((total, p) => total + p.weight, 0);
        for (const p of points) {
            p.dm = mass * p.weight / sum;
            p.r2 = distanceSquared(p, config);
            p.contribution = p.dm * p.r2;
            delete p.weight;
        }
        return points.sort((a, b) => a.r2 - b.r2);
    }

    function evaluate(input) {
        const config = normalize(input);
        const exact = analytic(config);
        const points = sample(config);
        const cumulative = [0];
        for (const p of points) cumulative.push(cumulative[cumulative.length - 1] + p.contribution);
        const numerical = cumulative[cumulative.length - 1];
        const maxDistance = Math.sqrt(points[points.length - 1].r2);
        const bins = Array.from({ length: 10 }, (_, i) => ({
            from: maxDistance * i / 10, to: maxDistance * (i + 1) / 10, mass: 0, inertia: 0
        }));
        for (const p of points) {
            const bin = bins[Math.min(9, maxDistance > 0 ? Math.floor(10 * Math.sqrt(p.r2) / maxDistance) : 0)];
            bin.mass += p.dm;
            bin.inertia += p.contribution;
        }
        return { config, exact, points, cumulative, numerical, bins, density: density(config) };
    }

    function motion(inertia, torque, time) {
        if (!Number.isFinite(inertia) || inertia <= 1e-12) return null;
        const alpha = torque / inertia;
        return { alpha, omega: alpha * time, angle: 0.5 * alpha * time * time, energy: 0.5 * inertia * (alpha * time) ** 2 };
    }

    function rotate(point, config, angle) {
        const { n, point: a } = axis(config);
        const v = [point.x - a[0], point.y - a[1], point.z - a[2]];
        const dot = v[0] * n[0] + v[2] * n[2];
        const cross = [-n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1]];
        const c = Math.cos(angle), s = Math.sin(angle);
        const rotated = v.map((value, i) => a[i] + value * c + cross[i] * s + n[i] * dot * (1 - c));
        return { x: rotated[0], y: rotated[1], z: rotated[2] };
    }

    const api = { SHAPES, DEFAULTS, normalize, axis, distanceSquared, principalMoments, analytic, density, sample, evaluate, motion, rotate };
    if (typeof module !== "undefined" && module.exports) module.exports = api;
    root.InertiaModel = api;
})(typeof window !== "undefined" ? window : globalThis);
