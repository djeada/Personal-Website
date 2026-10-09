(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const names = ['Orbit', 'Prism', 'Spark'];
    const colors = ['#84eee0', '#c4acff', '#ffc576'];
    const symbols = ['◯', '△', 'ϟ'];
    const gold = '#ffd36b';
    const params = new URLSearchParams(location.search);
    const raw = params.get('challenge') || '';
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw;
    const challenge = validDate ? raw : new Date().toISOString().slice(0, 10);
    const rawBeat = params.get('beat') || '';
    const rival = validDate && /^\d{1,4}$/.test(rawBeat) && Number(rawBeat) <= 3000 ? Number(rawBeat) : null;
    const seed = `oracle-v1:${challenge}`;
    const storageKey = 'neural-oracle-v1-best';
    const soundKey = 'neural-oracle-sound';
    const arena = $('oracle-arena');
    const canvas = $('network');
    const context = canvas.getContext('2d');
    const fxCanvas = $('particles');
    const fx = fxCanvas.getContext('2d');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const FORWARD = 520, BACKWARD = 760;
    let game, last, delta = null, frame = 0, animStart = 0, resealTimer = 0, best = 0;
    let particles = [], fxFrame = 0;
    try { best = Math.max(0, Math.min(3000, Number(localStorage.getItem(storageKey)) || 0)); } catch (_) { /* Storage may be unavailable. */ }
    $('challenge-label').textContent = `BRAIN ${challenge} · v1`;
    const fixed = value => value.toFixed(3);
    const signed = value => `${value >= 0 ? '+' : ''}${fixed(value)}`;
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
    const motion = () => !reducedMotion.matches && !document.hidden;

    const sound = (() => {
        let audio = null, master = null, enabled = true;
        try { enabled = localStorage.getItem(soundKey) !== 'off'; } catch (_) { /* Default to on. */ }
        function ready() {
            if (!enabled) return null;
            try {
                if (!audio) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    if (!AudioContext) return null;
                    audio = new AudioContext();
                    master = audio.createDynamicsCompressor();
                    const volume = audio.createGain();
                    volume.gain.value = .5;
                    master.connect(volume).connect(audio.destination);
                }
                if (audio.state === 'suspended') audio.resume();
            } catch (_) { return null; }
            return audio;
        }
        function tone(frequency, start, duration, { type = 'sine', gain = .3, slide = 1, attack = .006, cutoff = 0 } = {}) {
            const a = ready();
            if (!a) return;
            const t = a.currentTime + start;
            const osc = a.createOscillator(), amp = a.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(frequency, t);
            if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(frequency * slide, t + duration);
            amp.gain.setValueAtTime(.0001, t);
            amp.gain.exponentialRampToValueAtTime(gain, t + attack);
            amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
            let node = osc;
            if (cutoff) {
                const filter = a.createBiquadFilter();
                filter.type = 'lowpass'; filter.frequency.value = cutoff;
                node = node.connect(filter);
            }
            node.connect(amp).connect(master);
            osc.start(t); osc.stop(t + duration + .03);
        }
        function hiss(start, duration, gain, frequency) {
            const a = ready();
            if (!a) return;
            const t = a.currentTime + start;
            const buffer = a.createBuffer(1, Math.ceil(a.sampleRate * duration), a.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
            const source = a.createBufferSource(), filter = a.createBiquadFilter(), amp = a.createGain();
            source.buffer = buffer;
            filter.type = 'bandpass'; filter.frequency.setValueAtTime(frequency, t); filter.frequency.exponentialRampToValueAtTime(frequency * 3, t + duration);
            amp.gain.value = gain;
            source.connect(filter).connect(amp).connect(master);
            source.start(t);
        }
        return {
            get enabled() { return enabled; },
            set(on) {
                enabled = on;
                try { localStorage.setItem(soundKey, on ? 'on' : 'off'); } catch (_) { /* Preference is optional. */ }
                if (on) this.click(0);
            },
            click(choice) { tone([523.25, 659.25, 783.99][choice], 0, .09, { type: 'triangle', gain: .25 }); },
            escape(streak, points) {
                const root = 440 * 2 ** (Math.min(streak - 1, 9) / 12);
                [0, 4, 7, 12].forEach((step, i) => tone(root * 2 ** (step / 12), .06 + i * .05, .2, { type: 'square', gain: .07, cutoff: 3200 }));
                hiss(.02, .28, .12, 1800);
                if (points >= 85) tone(root * 4, .28, .5, { gain: .08, slide: 1.02 });
            },
            caught(confidence) {
                tone(165, .04, .36, { type: 'sawtooth', gain: .2, slide: .5, cutoff: 900 });
                tone(82, .04, .42, { gain: .35 + confidence * .2, slide: .6 });
            },
            finish(won) {
                const notes = won ? [0, 4, 7, 12, 16, 19, 24] : [7, 3, 0, -5];
                notes.forEach((step, i) => tone(392 * 2 ** (step / 12), i * .09, won ? .32 : .45, { type: won ? 'square' : 'sawtooth', gain: won ? .07 : .12, cutoff: 2400 }));
                if (won) hiss(.55, .6, .1, 3000);
            }
        };
    })();

    function syncSoundButton() {
        $('sound').setAttribute('aria-pressed', String(sound.enabled));
        $('sound').textContent = sound.enabled ? 'Sound on' : 'Sound off';
    }

    function state() {
        return last ? { ...last.snapshot, weights: last.before } : {
            ...game.network.forward(game.input()), weights: game.network
        };
    }

    function layout(width, height, current) {
        const layers = [current.input, current.hidden, current.probabilities];
        const xPositions = [width * .1, width * .48, width * .83];
        return layers.map((layer, l) => layer.map((_, i) => ({ x: xPositions[l], y: 25 + (height - 50) * (i + .5) / layer.length })));
    }

    function spark(a, b, progress, color, radius) {
        const x = a.x + (b.x - a.x) * progress, y = a.y + (b.y - a.y) * progress;
        const glow = context.createRadialGradient(x, y, 0, x, y, radius * 4);
        glow.addColorStop(0, color); glow.addColorStop(1, 'transparent');
        context.fillStyle = glow;
        context.fillRect(x - radius * 4, y - radius * 4, radius * 8, radius * 8);
    }

    function draw(elapsed = -1) {
        if (!context) return;
        const { width, height } = canvas.getBoundingClientRect();
        if (!width || !height) return;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const w = Math.round(width * dpr), h = Math.round(height * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        const current = state();
        const layers = [current.input, current.hidden, current.probabilities];
        const positions = layout(width, height, current);
        const animating = elapsed >= 0;
        const forward = animating ? clamp(elapsed / FORWARD) : 1;
        const backward = animating ? clamp((elapsed - FORWARD) / BACKWARD) : 0;
        const learnGlow = animating && delta ? Math.sin(Math.PI * backward) : 0;
        context.globalCompositeOperation = 'source-over';
        [current.weights.w1, current.weights.w2].forEach((matrix, l) => {
            matrix.forEach((row, j) => row.forEach((weight, i) => {
                const a = positions[l][i], b = positions[l + 1][j];
                context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
                context.strokeStyle = weight >= 0 ? '#84eee0' : '#fc94c3';
                context.globalAlpha = Math.min(.65, .08 + Math.abs(weight) * .35);
                context.lineWidth = .4 + Math.min(2, Math.abs(weight) * 2);
                context.stroke();
                const change = delta ? delta[l][j][i] / delta.max : 0;
                if (learnGlow > 0 && change > .2) {
                    context.strokeStyle = gold;
                    context.globalAlpha = learnGlow * change * .9;
                    context.lineWidth = 1 + change * 2.5;
                    context.stroke();
                }
            }));
        });
        context.globalAlpha = 1;
        if (animating) {
            context.globalCompositeOperation = 'lighter';
            [current.weights.w1, current.weights.w2].forEach((matrix, l) => {
                const phase = forward * 2 - l;
                if (phase > 0 && phase < 1) matrix.forEach((row, j) => row.forEach((weight, i) => {
                    const signal = Math.abs(layers[l][i] * weight);
                    if (signal > .04) spark(positions[l][i], positions[l + 1][j], phase, weight >= 0 ? 'rgba(220,255,250,.9)' : 'rgba(255,190,225,.9)', 1.2 + Math.min(1.6, signal * 3));
                }));
                const back = backward * 2 - (1 - l);
                if (delta && back > 0 && back < 1) matrix.forEach((row, j) => row.forEach((_, i) => {
                    const change = delta[l][j][i] / delta.max;
                    if (change > .25) spark(positions[l + 1][j], positions[l][i], back, 'rgba(255,211,107,.95)', 1.2 + change * 2);
                }));
            });
            context.globalCompositeOperation = 'source-over';
        }
        const revealed = last && forward >= 1;
        positions.forEach((layer, l) => layer.forEach((point, i) => {
            const activation = Math.abs(layers[l][i]);
            const lit = l === 0 ? forward > 0 : l === 1 ? forward > .5 : forward >= 1;
            const shown = animating && !lit ? 0 : activation;
            const color = l === 2 ? colors[i] : '#84eee0';
            const outer = l === 2 ? 14 : 6 + shown * 3;
            if (shown > .3) {
                const halo = context.createRadialGradient(point.x, point.y, outer * .5, point.x, point.y, outer * 2.6);
                halo.addColorStop(0, `${color}55`); halo.addColorStop(1, `${color}00`);
                context.fillStyle = halo;
                context.beginPath(); context.arc(point.x, point.y, outer * 2.6, 0, Math.PI * 2); context.fill();
            }
            context.beginPath(); context.arc(point.x, point.y, outer, 0, Math.PI * 2);
            context.fillStyle = '#101d33'; context.fill(); context.strokeStyle = color; context.lineWidth = 1 + shown * 2; context.stroke();
            context.beginPath(); context.arc(point.x, point.y, l === 2 ? 6 + shown * 5 : 2 + shown * 3, 0, Math.PI * 2);
            context.fillStyle = color; context.globalAlpha = .2 + .8 * shown; context.fill(); context.globalAlpha = 1;
            context.font = `${width < 450 ? 9 : 11}px monospace`; context.fillStyle = '#b1c1db';
            if (l === 0) context.fillText(`${Math.floor(i / 3) + 1}${'OPS'[i % 3]}`, point.x - 27, point.y + 4);
            if (l === 1) context.fillText(`h${i + 1}`, point.x + 14, point.y + 4);
            if (l === 2) {
                context.fillStyle = color;
                context.fillText(`${symbols[i]} ${Math.round(activation * 100)}%`, point.x + 20, point.y + 4);
                if (revealed && last.prediction === i) {
                    context.setLineDash([3, 3]); context.strokeStyle = '#fff'; context.lineWidth = 1;
                    context.beginPath(); context.arc(point.x, point.y, 20, 0, Math.PI * 2); context.stroke(); context.setLineDash([]);
                    context.fillStyle = '#fff'; context.fillText('BET', point.x - 11, point.y - 25);
                }
                if (revealed && last.choice === i) {
                    const ring = animating ? 1 - backward : 0;
                    context.strokeStyle = last.escaped ? '#84eee0' : '#fc94c3';
                    context.globalAlpha = .4 + .6 * ring; context.lineWidth = 2 + ring * 2;
                    context.beginPath(); context.arc(point.x, point.y, 24 + ring * 10, 0, Math.PI * 2); context.stroke();
                    context.globalAlpha = 1;
                }
            }
        }));
    }

    function setPhase(text) {
        if ($('phase').textContent !== text) $('phase').textContent = text;
    }

    function animate() {
        cancelAnimationFrame(frame);
        if (!motion()) { setPhase(''); draw(); return; }
        animStart = performance.now();
        function tick(now) {
            const elapsed = now - animStart;
            const done = elapsed > FORWARD + BACKWARD;
            setPhase(done ? '' : elapsed < FORWARD ? 'FORWARD PASS · PREDICTING' : 'BACKPROP · LEARNING FROM YOU');
            draw(done ? -1 : elapsed);
            if (!done && !document.hidden) frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
    }

    function burst(origin, color, count, speed) {
        if (!motion()) return;
        const box = arena.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        if (fxCanvas.width !== Math.round(box.width * dpr) || fxCanvas.height !== Math.round(box.height * dpr)) {
            fxCanvas.width = Math.round(box.width * dpr); fxCanvas.height = Math.round(box.height * dpr);
        }
        const x = origin.left + origin.width / 2 - box.left, y = origin.top + origin.height / 2 - box.top;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2, velocity = speed * (.35 + Math.random());
            particles.push({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - speed * .4, life: 1, size: 1.5 + Math.random() * 3, color: Math.random() < .25 ? '#ffffff' : color });
        }
        if (!fxFrame) fxFrame = requestAnimationFrame(stepParticles);
    }

    function stepParticles() {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        fx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
        fx.globalCompositeOperation = 'lighter';
        particles = particles.filter(p => p.life > 0);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.vy += .18; p.vx *= .985; p.life -= .022;
            fx.globalAlpha = Math.max(0, p.life);
            fx.fillStyle = p.color;
            fx.beginPath(); fx.arc(p.x, p.y, p.size * (.5 + p.life / 2), 0, Math.PI * 2); fx.fill();
        });
        fx.globalAlpha = 1;
        fxFrame = particles.length ? requestAnimationFrame(stepParticles) : 0;
    }

    function retrigger(element, className) {
        element.classList.remove(className);
        void element.offsetWidth;
        element.classList.add(className);
    }

    function matrix(id, weights, biases, updated, updatedBiases, labels, rows) {
        let largest = 0;
        weights.forEach((row, j) => [...row, biases[j]].forEach((weight, i) => {
            largest = Math.max(largest, Math.abs((i === row.length ? updatedBiases[j] : updated[j][i]) - weight));
        }));
        // Labels are internal constants; all numeric values come from the model.
        $(id).innerHTML = `<thead><tr><th scope="col">To ↓ / From →</th>${labels.map(label => `<th scope="col">${label}</th>`).join('')}<th scope="col">Bias</th></tr></thead><tbody>${weights.map((row, j) => `<tr><th scope="row">${rows[j]}</th>${[...row, biases[j]].map((weight, i) => {
            const next = i === row.length ? updatedBiases[j] : updated[j][i];
            const big = largest > 1e-9 && Math.abs(next - weight) >= largest * .6 ? ' big-change' : '';
            return `<td class="${weight >= 0 ? 'positive' : 'negative'}${big}">${signed(weight)}<small>Δ ${signed(next - weight)}</small></td>`;
        }).join('')}</tr>`).join('')}</tbody>`;
    }

    function inspect() {
        const current = state();
        const k = Number($('inspect-output').value);
        const row = current.weights.w2[k];
        const logit = row.reduce((sum, weight, j) => sum + weight * current.hidden[j], current.weights.b2[k]);
        $('neuron-equation').textContent = `a(${names[k]}) = ${row.map((weight, j) => `(${fixed(weight)} × ${fixed(current.hidden[j])})`).join(' + ')} + (${fixed(current.weights.b2[k])}) = ${fixed(logit)} → softmax = ${(current.probabilities[k] * 100).toFixed(1)}%`;
        if (last) {
            const target = Number(last.choice === k);
            const gradient = (current.probabilities[k] - target) * current.hidden[0];
            $('gradient-equation').textContent = `Example: ∂L/∂W²(${names[k]}, h1) = (p − target) × h1 = (${fixed(current.probabilities[k])} − ${target}) × ${fixed(current.hidden[0])} = ${fixed(gradient)}. New weight = ${fixed(row[0])} − 0.22 × (${fixed(gradient)}) = ${fixed(game.network.w2[k][0])}.`;
        } else $('gradient-equation').textContent = 'The target is 1 for your chosen symbol and 0 for the other outputs. Play a move to see the gradient.';
    }

    function updateLab() {
        const current = state();
        $('lab-step').textContent = last ? `Move ${game.results.length} · prediction → update` : 'Untrained brain';
        $('input-values').textContent = `x = [${current.input.join(', ')}]`;
        $('hidden-values').textContent = `h = [${current.hidden.map(fixed).join(', ')}]`;
        $('probability-values').textContent = current.probabilities.map((p, i) => `${names[i]} ${(p * 100).toFixed(1)}%`).join(' · ');
        $('probability-bars').replaceChildren(...current.probabilities.map((p, i) => {
            const bar = document.createElement('span');
            bar.style.setProperty('--p', `${(p * 100).toFixed(1)}%`);
            bar.style.setProperty('--c', colors[i]);
            if (last && last.choice === i) bar.className = 'chosen';
            bar.textContent = symbols[i];
            return bar;
        }));
        $('loss-values').textContent = last ? `L = −ln(${fixed(current.probabilities[last.choice])}) = ${fixed(last.loss)} nats. ${last.points} points of surprise. Higher loss means this choice surprised the network more.` : 'Click a symbol to see its loss and a real gradient update.';
        if (!last) $('lesson').textContent = 'Try repeating Orbit a few times, then switch. Watch the probability rise, the surprise spike, and the weights adapt.';
        else if (game.results.length === 1) $('lesson').textContent = 'Cold start: no history means all hidden activations are zero. Only the biases can learn on this first move. Look for nonzero Δ in the Bias columns.';
        else if (last.loss > 1.5) $('lesson').textContent = 'You broke its expectation. High loss pushes probability toward the symbol you just chose. Inspect the output weights to see the correction.';
        else if (last.snapshot.probabilities[last.choice] > .6) $('lesson').textContent = 'It is learning your pattern. A confident correct guess gives you fewer points. Can you bait the network, then switch?';
        else $('lesson').textContent = 'Its memory covers only three clicks. It can learn local patterns, but it cannot read your mind. Try a repeating cycle and inspect the hidden activations.';
        const inputLabels = [1, 2, 3].flatMap(n => ['O', 'P', 'S'].map(symbol => `${n}:${symbol}`));
        const hiddenLabels = Array.from({ length: 8 }, (_, i) => `h${i + 1}`);
        matrix('weights-one', current.weights.w1, current.weights.b1, game.network.w1, game.network.b1, inputLabels, hiddenLabels);
        matrix('weights-two', current.weights.w2, current.weights.b2, game.network.w2, game.network.b2, hiddenLabels, names);
        inspect();
    }

    function updateMemory() {
        const recent = game.history.slice(-3).reverse();
        $('memory').replaceChildren(...[0, 1, 2].map(i => {
            const slot = document.createElement('li');
            const choice = recent[i];
            slot.textContent = choice === undefined ? '·' : symbols[choice];
            slot.style.color = choice === undefined ? '' : colors[choice];
            if (choice !== undefined) slot.dataset.symbol = String(choice);
            slot.setAttribute('aria-label', choice === undefined ? 'empty' : `${i === 0 ? 'newest' : i === 1 ? 'previous' : 'oldest'}: ${names[choice]}`);
            return slot;
        }));
    }

    function seal() {
        clearTimeout(resealTimer);
        $('guess-card').classList.remove('revealed', 'hit', 'miss');
        $('pick-card').classList.remove('revealed');
        $('guess-symbol').textContent = '';
        $('pick-symbol').textContent = '?'; $('pick-symbol').style.color = ''; delete $('pick-symbol').dataset.symbol;
        $('guess-detail').textContent = game.results.length ? 'Next guess locked' : 'Locked before you click';
        $('pick-detail').textContent = 'Your move';
        $('verdict').textContent = 'VS'; $('verdict').className = '';
    }

    function reveal(result) {
        clearTimeout(resealTimer);
        const confidence = result.snapshot.probabilities[result.prediction];
        $('guess-symbol').textContent = symbols[result.prediction];
        $('guess-symbol').style.color = colors[result.prediction];
        $('guess-symbol').dataset.symbol = String(result.prediction);
        $('guess-detail').textContent = `${Math.round(confidence * 100)}% sure`;
        $('pick-symbol').textContent = symbols[result.choice];
        $('pick-symbol').style.color = colors[result.choice];
        $('pick-symbol').dataset.symbol = String(result.choice);
        $('pick-detail').textContent = `${Math.round(result.snapshot.probabilities[result.choice] * 100)}% expected`;
        $('guess-card').classList.add('revealed', result.escaped ? 'miss' : 'hit');
        $('pick-card').classList.add('revealed');
        $('verdict').textContent = result.escaped ? 'ESCAPED' : 'PREDICTED';
        $('verdict').className = result.escaped ? 'escaped' : 'caught';
        retrigger($('verdict'), 'stamp');
        $('points-pop').textContent = `+${result.points}`;
        retrigger($('points-pop'), 'pop');
        if (game.results.length < 30) resealTimer = setTimeout(seal, 1700);
    }

    function taunt(result) {
        const moves = game.results.length;
        const confidence = result.snapshot.probabilities[result.prediction];
        const recent = game.history.slice(-3);
        if (moves === 1) return result.escaped ? 'No history, no clue. That one was a blind guess. Enjoy it.' : 'A blind guess, and still right. This is going to be easy.';
        if (moves === 30) return '';
        if (result.escaped) {
            if (game.streak >= 4) return pick(['Stop that.', 'Who taught you this?', 'Are you… a random number generator?', `${game.streak} in a row. I am taking notes.`]);
            if (result.points >= 85) return pick(['…That should not have happened.', 'Impossible. Recalibrating.', 'Okay. That one hurt.', 'Lucky. Do it again.']);
            return pick(['Close.', 'Hmm. Noted.', 'Fine. I am learning.', 'You cannot keep that up.']);
        }
        if (recent.length === 3 && recent.every(choice => choice === result.choice)) return `${names[result.choice]} again? Of course.`;
        if (confidence >= .7) return pick(['Too easy.', 'Saw that coming.', 'Predictable. Adorable.', 'You are on autopilot.', 'I could do this asleep.']);
        return pick(['Got you.', 'Read you like a book.', 'Called it.', 'Pattern detected.']);
    }

    function rank(score) {
        if (score >= 2450) return ['ORACLE BREAKER', 'You out-modeled the model.'];
        if (score >= 2200) return ['CHAOS AGENT', 'It never found its footing.'];
        if (score >= 1950) return ['HARD TO READ', 'About as surprising as a fair die.'];
        if (score >= 1650) return ['CREATURE OF HABIT', 'It found a pattern and leaned on it.'];
        return ['OPEN BOOK', 'The Oracle read you like a book.'];
    }

    function habits() {
        const results = game.results;
        const counts = [0, 1, 2].map(k => results.filter(r => r.choice === k).length);
        const lines = [];
        const favorite = counts.indexOf(Math.max(...counts));
        lines.push(counts[favorite] >= 14
            ? `You picked ${symbols[favorite]} ${names[favorite]} ${counts[favorite]} of 30 times. A clear favorite is the easiest pattern to learn.`
            : `Your picks were balanced: ${counts.map((c, k) => `${symbols[k]} ${c}`).join(' · ')}. Balance alone is not unpredictability.`);
        const repeats = results.slice(1).filter((r, i) => r.choice === results[i].choice).length;
        const repeatRate = Math.round(repeats / 29 * 100);
        lines.push(repeatRate < 22
            ? `You repeated your previous pick only ${repeatRate}% of the time. A random clicker repeats about 33%. Avoiding repeats is a habit too.`
            : repeatRate > 45 ? `You repeated your previous pick ${repeatRate}% of the time (random: about 33%). Streaks of the same symbol are easy to learn.`
                : `You repeated your previous pick ${repeatRate}% of the time, close to the 33% a random clicker would.`);
        let strongest = null;
        [0, 1, 2].forEach(from => {
            const next = results.slice(1).filter((r, i) => results[i].choice === from).map(r => r.choice);
            if (next.length < 4) return;
            [0, 1, 2].forEach(to => {
                const share = next.filter(choice => choice === to).length / next.length;
                if (!strongest || share > strongest.share) strongest = { from, to, share, hits: next.filter(choice => choice === to).length, total: next.length };
            });
        });
        if (strongest && strongest.share >= .5) lines.push(`After ${symbols[strongest.from]} you went ${symbols[strongest.to]} ${strongest.hits} of ${strongest.total} times. That is exactly the kind of rule its 3-click memory can learn.`);
        const early = results.slice(0, 10).filter(r => !r.escaped).length, late = results.slice(-10).filter(r => !r.escaped).length;
        lines.push(late > early
            ? `It caught you ${early}/10 times in the first 10 moves and ${late}/10 in the last 10. That improvement is learning.`
            : `It caught you ${early}/10 times early and ${late}/10 late. It never got a firm grip on you.`);
        $('habits').replaceChildren(...lines.map(line => { const item = document.createElement('li'); item.textContent = line; return item; }));
    }

    function chart() {
        const chartCanvas = $('confidence-chart');
        const ctx = chartCanvas.getContext('2d');
        if (!ctx) return;
        const { width, height } = chartCanvas.getBoundingClientRect();
        if (!width) return;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        chartCanvas.width = Math.round(width * dpr); chartCanvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const pad = 8, slot = (width - pad * 2) / 30, base = height - 16;
        game.results.forEach((r, i) => {
            const p = r.snapshot.probabilities[r.choice];
            ctx.fillStyle = r.escaped ? '#84eee0' : '#fc94c3';
            ctx.fillRect(pad + i * slot + slot * .15, base - p * (base - 8), slot * .7, p * (base - 8));
        });
        ctx.strokeStyle = '#edf4ff'; ctx.setLineDash([4, 4]); ctx.globalAlpha = .6;
        ctx.beginPath(); ctx.moveTo(pad, base - (base - 8) / 3); ctx.lineTo(width - pad, base - (base - 8) / 3); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ctx.fillStyle = '#a9bad6'; ctx.font = '10px monospace';
        ctx.fillText('move 1', pad, height - 3); ctx.fillText('30', width - pad - 14, height - 3);
    }

    function shareUrl() {
        const url = new URL(location.pathname, location.origin);
        url.searchParams.set('challenge', challenge);
        if (game.results.length === 30) url.searchParams.set('beat', String(game.score));
        return url.href;
    }

    function shareText() {
        const escaped = game.results.filter(result => result.escaped).length;
        const pattern = game.results.map(result => result.escaped ? '🟩' : '🟪');
        return `OUTCLICK THE ORACLE · ${challenge} · v1\n${game.score}/3000 surprise points · ${escaped}/30 escapes · ${rank(game.score)[0]}\n${[0, 10, 20].map(start => pattern.slice(start, start + 10).join('')).join('\n')}\nA 107-parameter neural net tried to predict me. Can you beat my score against the same starting brain?\n${shareUrl()}`;
    }

    function scoreCard() {
        const card = document.createElement('canvas');
        card.width = 1080; card.height = 1350;
        const ctx = card.getContext('2d');
        const background = ctx.createRadialGradient(540, 420, 40, 540, 600, 900);
        background.addColorStop(0, '#172949'); background.addColorStop(1, '#060b18');
        ctx.fillStyle = background; ctx.fillRect(0, 0, 1080, 1350);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#84eee0'; ctx.font = '700 30px monospace';
        ctx.fillText('A NEURAL NETWORK TRIED TO PREDICT ME', 540, 130);
        ctx.fillStyle = '#edf4ff'; ctx.font = '800 92px system-ui, sans-serif';
        ctx.fillText('Outclick the Oracle', 540, 240);
        ctx.font = '900 250px system-ui, sans-serif'; ctx.fillStyle = '#84eee0';
        ctx.fillText(game.score.toLocaleString('en-US'), 540, 500);
        ctx.font = '600 40px monospace'; ctx.fillStyle = '#a9bad6';
        ctx.fillText('/ 3,000 SURPRISE POINTS', 540, 565);
        ctx.font = '900 76px system-ui, sans-serif'; ctx.fillStyle = gold;
        ctx.fillText(rank(game.score)[0], 540, 680);
        const size = 78, gap = 12, left = 540 - (10 * size + 9 * gap) / 2;
        game.results.forEach((r, i) => {
            const x = left + (i % 10) * (size + gap), y = 750 + Math.floor(i / 10) * (size + gap);
            ctx.fillStyle = r.escaped ? '#84eee0' : '#fc94c3';
            ctx.globalAlpha = r.escaped ? 1 : .85;
            ctx.beginPath(); ctx.roundRect(x, y, size, size, 14); ctx.fill();
            ctx.globalAlpha = 1; ctx.fillStyle = '#080f20'; ctx.font = '700 44px system-ui, sans-serif';
            ctx.fillText(symbols[r.choice], x + size / 2, y + size / 2 + 16);
        });
        const escapes = game.results.filter(r => r.escaped).length;
        ctx.font = '600 38px system-ui, sans-serif'; ctx.fillStyle = '#edf4ff';
        ctx.fillText(`${escapes}/30 escapes · best streak ${game.bestStreak} · brain ${challenge}`, 540, 1090);
        ctx.font = '700 44px system-ui, sans-serif'; ctx.fillStyle = '#ffffff';
        ctx.fillText('Think you are less predictable?', 540, 1190);
        ctx.font = '600 34px monospace'; ctx.fillStyle = '#84eee0';
        ctx.fillText('adamdjellouli.com/tools/neural_oracle', 540, 1250);
        return card;
    }

    function finish() {
        document.querySelectorAll('[data-choice]').forEach(button => { button.disabled = true; });
        const escapes = game.results.filter(result => result.escaped).length;
        const [title, line] = rank(game.score);
        $('result-rank').textContent = `EXPERIMENT COMPLETE · ${title}`;
        $('result-title').textContent = `${game.score.toLocaleString()} points. ${line}`;
        let summary = `${escapes}/30 escapes · Longest escape streak: ${game.bestStreak}. Clicking truly at random averages about 2,000.`;
        if (rival !== null) summary += game.score > rival ? ` You beat your friend’s ${rival.toLocaleString()} by ${(game.score - rival).toLocaleString()}.` : ` Your friend’s ${rival.toLocaleString()} still stands. Restart the same brain and try again.`;
        $('result-summary').textContent = summary;
        $('taunt').textContent = game.score >= 2000 ? 'You were harder to read than a coin flip. I hate that.' : 'Thank you for the training data.';
        $('native-share').hidden = typeof navigator.share !== 'function';
        $('result').hidden = false;
        habits(); chart();
        $('result-title').focus({ preventScroll: true });
        sound.finish(game.score >= 2000);
        if (game.score >= 2000) burst($('result').getBoundingClientRect(), gold, 90, 7);
        if (game.score > best) {
            best = game.score;
            try { localStorage.setItem(storageKey, String(best)); } catch (_) { /* Game works without persistence. */ }
        }
        $('best').textContent = `Best on this device: ${best.toLocaleString()}`;
    }

    function play(choice) {
        const result = game.play(choice);
        if (!result) return;
        last = result;
        const after = game.network;
        const diff = (before, now) => before.map((row, j) => row.map((weight, i) => Math.abs(now[j][i] - weight)));
        delta = [diff(result.before.w1, after.w1), diff(result.before.w2, after.w2)];
        delta.max = Math.max(1e-9, ...delta.flat(2));
        const caught = game.results.filter(r => !r.escaped).length;
        $('score').textContent = game.score.toLocaleString();
        $('round').textContent = `${game.results.length} / 30`;
        $('streak').textContent = String(game.streak);
        $('accuracy').textContent = `${Math.round(caught / game.results.length * 100)}%`;
        retrigger($('score').parentElement, 'bump');
        $('feedback').textContent = `${result.escaped ? 'Escaped!' : 'Predicted!'} It guessed ${names[result.prediction]}; you chose ${names[choice]}. +${result.points} points.`;
        $('taunt').textContent = taunt(result);
        const marker = $('history').children[game.results.length - 1];
        marker.className = result.escaped ? 'escaped' : 'caught';
        marker.textContent = symbols[choice];
        marker.title = `Move ${game.results.length}: ${names[choice]}, ${result.escaped ? 'escaped' : 'predicted'}, +${result.points}`;
        marker.setAttribute('aria-label', marker.title);
        $('inspect-output').value = String(choice);
        const button = document.querySelector(`[data-choice="${choice}"]`);
        retrigger(button, 'pressed');
        sound.click(choice);
        if (result.escaped) {
            sound.escape(game.streak, result.points);
            burst(button.getBoundingClientRect(), colors[choice], 14 + Math.round(result.points / 4) + game.streak * 4, 3 + result.points / 30);
            retrigger($('flash'), 'escape');
        } else {
            sound.caught(result.snapshot.probabilities[result.prediction]);
            if (motion()) retrigger(arena, 'shake');
            retrigger($('flash'), 'caught');
            if (sound.enabled && navigator.vibrate) navigator.vibrate(35);
        }
        arena.dataset.streak = String(Math.min(game.streak, 5));
        reveal(result); updateMemory(); updateLab(); animate();
        if (game.results.length === 30) finish();
    }

    function reset() {
        cancelAnimationFrame(frame);
        game = new NeuralOracle.Game(seed); last = null; delta = null;
        $('score').textContent = '0'; $('round').textContent = '0 / 30'; $('streak').textContent = '0'; $('accuracy').textContent = '—';
        $('result').hidden = true; $('share-fallback').hidden = true; $('share-status').textContent = '';
        $('feedback').textContent = 'Pick any symbol. The Oracle predicts first, then learns from your click.';
        $('taunt').textContent = 'I have already made my prediction. Go ahead. Surprise me.';
        $('best').textContent = `Best on this device: ${best ? best.toLocaleString() : '—'}`;
        $('history').replaceChildren(...Array.from({ length: 30 }, (_, i) => {
            const marker = document.createElement('span'); marker.setAttribute('aria-label', `Move ${i + 1}: not played`); return marker;
        }));
        arena.dataset.streak = '0';
        document.querySelectorAll('[data-choice]').forEach(button => { button.disabled = false; });
        setPhase(''); seal(); updateMemory(); updateLab(); draw();
    }

    async function copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            $('share-status').textContent = 'Copied! Paste it into a post or send it to a friend.';
        } catch (_) {
            $('share-fallback').value = text; $('share-fallback').hidden = false;
            $('share-fallback').focus(); $('share-fallback').select();
            $('share-status').textContent = 'Clipboard unavailable. Copy the selected challenge below.';
        }
    }

    if (rival !== null) {
        $('rival').hidden = false;
        $('rival').textContent = `A friend scored ${rival.toLocaleString()} against this exact brain. Beat it.`;
    }
    syncSoundButton();
    document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.choice))));
    document.addEventListener('keydown', event => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (/^[123]$/.test(event.key) && game.results.length < 30) {
            event.preventDefault();
            play(Number(event.key) - 1);
        }
    });
    $('restart').addEventListener('click', () => { reset(); document.querySelector('[data-choice]').focus({ preventScroll: true }); });
    $('sound').addEventListener('click', () => { sound.set(!sound.enabled); syncSoundButton(); });
    $('inspect-output').addEventListener('change', inspect);
    $('share').addEventListener('click', () => copy(shareText()));
    $('native-share').addEventListener('click', async () => {
        try { await navigator.share({ title: 'Outclick the Oracle', text: shareText().split('\n').slice(0, 5).join('\n'), url: shareUrl() }); } catch (error) { if (error.name !== 'AbortError') copy(shareText()); }
    });
    $('card').addEventListener('click', () => {
        scoreCard().toBlob(blob => {
            if (!blob) { $('share-status').textContent = 'Could not create the image in this browser.'; return; }
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `outclick-the-oracle-${challenge}-${game.score}.png`;
            document.body.append(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 4000);
            $('share-status').textContent = 'Score card saved. Post it with your challenge link.';
        }, 'image/png');
    });
    new ResizeObserver(() => { draw(); if (!$('result').hidden) chart(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(frame); else draw(); });
    reducedMotion.addEventListener('change', () => { cancelAnimationFrame(frame); setPhase(''); draw(); });
    reset();
})();
