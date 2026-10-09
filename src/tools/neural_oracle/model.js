/* A small, deterministic 9 → 8 → 3 neural network. No services or dependencies. */
(function (root) {
    'use strict';

    function seededRandom(seed) {
        let value = 2166136261;
        for (const character of String(seed)) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
        return function () {
            value += 0x6D2B79F5;
            let t = Math.imul(value ^ value >>> 15, 1 | value);
            t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    class Network {
        constructor(seed) {
            const random = seededRandom(seed);
            this.w1 = Array.from({ length: 8 }, () => Array.from({ length: 9 }, () => (random() - 0.5) * 0.8));
            this.w2 = Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => (random() - 0.5) * 0.8));
            this.b1 = Array(8).fill(0);
            this.b2 = Array(3).fill(0);
        }

        forward(input) {
            const hidden = this.w1.map((row, j) => Math.tanh(row.reduce((sum, w, i) => sum + w * input[i], this.b1[j])));
            const logits = this.w2.map((row, k) => row.reduce((sum, w, j) => sum + w * hidden[j], this.b2[k]));
            const maximum = Math.max(...logits);
            const exp = logits.map(value => Math.exp(value - maximum));
            const total = exp.reduce((a, b) => a + b, 0);
            return { input: input.slice(), hidden, probabilities: exp.map(value => value / total) };
        }

        train(input, target) {
            const { hidden, probabilities } = this.forward(input);
            const outputError = probabilities.map((p, k) => p - Number(k === target));
            // Compute hidden gradients before changing output weights.
            const hiddenError = hidden.map((h, j) => (1 - h * h) * this.w2.reduce((sum, row, k) => sum + row[j] * outputError[k], 0));
            const rate = 0.22;
            this.w2.forEach((row, k) => {
                row.forEach((w, j) => { row[j] = w - rate * outputError[k] * hidden[j]; });
                this.b2[k] -= rate * outputError[k];
            });
            this.w1.forEach((row, j) => {
                row.forEach((w, i) => { row[i] = w - rate * hiddenError[j] * input[i]; });
                this.b1[j] -= rate * hiddenError[j];
            });
        }
    }

    class Game {
        constructor(seed) {
            this.network = new Network(seed);
            this.history = [];
            this.results = [];
            this.score = 0;
            this.streak = 0;
            this.bestStreak = 0;
        }

        input() {
            const values = Array(9).fill(0);
            this.history.slice(-3).reverse().forEach((choice, i) => { values[i * 3 + choice] = 1; });
            return values;
        }

        play(choice) {
            if (!Number.isInteger(choice) || choice < 0 || choice > 2 || this.results.length >= 30) return null;
            const input = this.input();
            // Commit a prediction before observing/training on the current click.
            const snapshot = this.network.forward(input);
            const prediction = snapshot.probabilities.indexOf(Math.max(...snapshot.probabilities));
            const escaped = choice !== prediction;
            const points = Math.round(100 * (1 - snapshot.probabilities[choice]));
            this.score += points;
            this.streak = escaped ? this.streak + 1 : 0;
            this.bestStreak = Math.max(this.bestStreak, this.streak);
            const before = {
                w1: this.network.w1.map(row => row.slice()), w2: this.network.w2.map(row => row.slice()),
                b1: this.network.b1.slice(), b2: this.network.b2.slice()
            };
            const loss = -Math.log(Math.max(snapshot.probabilities[choice], 1e-15));
            const result = { choice, prediction, escaped, points, snapshot, before, loss };
            this.results.push(result);
            this.network.train(input, choice);
            this.history.push(choice);
            return result;
        }
    }

    const api = { Network, Game };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.NeuralOracle = api;
})(typeof window !== 'undefined' ? window : globalThis);
