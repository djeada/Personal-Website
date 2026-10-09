(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const names = ['Orbit', 'Prism', 'Spark'];
    const colors = ['#84eee0', '#c4acff', '#ffc576'];
    const symbols = ['◯', '△', 'ϟ'];
    const raw = new URLSearchParams(location.search).get('challenge') || '';
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) && Number.isFinite(Date.parse(raw)) && new Date(raw).toISOString().slice(0, 10) === raw;
    const challenge = validDate ? raw : new Date().toISOString().slice(0, 10);
    const seed = `oracle-v1:${challenge}`;
    const storageKey = 'neural-oracle-v1-best';
    const canvas = $('network');
    const context = canvas.getContext('2d');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let game, last, frame = 0, best = 0;
    try { best = Math.max(0, Math.min(3000, Number(localStorage.getItem(storageKey)) || 0)); } catch (_) { /* Storage may be unavailable. */ }
    $('challenge-label').textContent = `BRAIN ${challenge} · v1`;
    const fixed = value => value.toFixed(3);
    const signed = value => `${value >= 0 ? '+' : ''}${fixed(value)}`;

    function state() {
        return last ? { ...last.snapshot, weights: last.before } : {
            ...game.network.forward(game.input()), weights: game.network
        };
    }

    function draw(pulse = -1) {
        if (!context) return;
        const { width, height } = canvas.getBoundingClientRect();
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const w = Math.round(width * dpr), h = Math.round(height * dpr);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        const current = state();
        const layers = [current.input, current.hidden, current.probabilities];
        const xPositions = [width * .1, width * .48, width * .83];
        const positions = layers.map((layer, l) => layer.map((_, i) => ({ x: xPositions[l], y: 25 + (height - 50) * (i + .5) / layer.length })));
        [current.weights.w1, current.weights.w2].forEach((matrix, l) => {
            matrix.forEach((row, j) => row.forEach((weight, i) => {
                const a = positions[l][i], b = positions[l + 1][j];
                context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y);
                context.strokeStyle = weight >= 0 ? '#84eee0' : '#fc94c3';
                context.globalAlpha = Math.min(.65, .08 + Math.abs(weight) * .35);
                context.lineWidth = .4 + Math.min(2, Math.abs(weight) * 2);
                context.stroke();
                const phase = pulse * 2 - l;
                if (phase >= 0 && phase <= 1 && Math.abs(layers[l][i]) > .05) {
                    context.globalAlpha = .8; context.fillStyle = '#fff';
                    context.beginPath(); context.arc(a.x + (b.x - a.x) * phase, a.y + (b.y - a.y) * phase, 1.8, 0, Math.PI * 2); context.fill();
                }
            }));
        });
        context.globalAlpha = 1;
        positions.forEach((layer, l) => layer.forEach((point, i) => {
            const activation = Math.abs(layers[l][i]);
            const color = l === 2 ? colors[i] : '#84eee0';
            context.beginPath(); context.arc(point.x, point.y, l === 2 ? 14 : 6 + activation * 3, 0, Math.PI * 2);
            context.fillStyle = '#101d33'; context.fill(); context.strokeStyle = color; context.lineWidth = 1 + activation * 2; context.stroke();
            context.beginPath(); context.arc(point.x, point.y, l === 2 ? 6 + activation * 5 : 2 + activation * 3, 0, Math.PI * 2);
            context.fillStyle = color; context.globalAlpha = .2 + .8 * activation; context.fill(); context.globalAlpha = 1;
            context.font = `${width < 450 ? 9 : 11}px monospace`; context.fillStyle = '#b1c1db';
            if (l === 0) context.fillText(`${Math.floor(i / 3) + 1}${'OPS'[i % 3]}`, point.x - 27, point.y + 4);
            if (l === 1) context.fillText(`h${i + 1}`, point.x + 14, point.y + 4);
            if (l === 2) {
                context.fillStyle = color;
                context.fillText(`${symbols[i]} ${Math.round(activation * 100)}%`, point.x + 20, point.y + 4);
            }
        }));
    }

    function animate() {
        cancelAnimationFrame(frame);
        if (reducedMotion.matches || document.hidden) { draw(); return; }
        const start = performance.now();
        function tick(now) {
            const progress = (now - start) / 650;
            draw(progress <= 1 ? progress : -1);
            if (progress < 1 && !document.hidden) frame = requestAnimationFrame(tick);
        }
        frame = requestAnimationFrame(tick);
    }

    function matrix(id, weights, biases, updated, updatedBiases, labels, rows) {
        // Labels are internal constants; all numeric values come from the model.
        $(id).innerHTML = `<thead><tr><th scope="col">To ↓ / From →</th>${labels.map(label => `<th scope="col">${label}</th>`).join('')}<th scope="col">Bias</th></tr></thead><tbody>${weights.map((row, j) => `<tr><th scope="row">${rows[j]}</th>${[...row, biases[j]].map((weight, i) => {
            const next = i === row.length ? updatedBiases[j] : updated[j][i];
            return `<td class="${weight >= 0 ? 'positive' : 'negative'}">${signed(weight)}<small>Δ ${signed(next - weight)}</small></td>`;
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

    function shareText() {
        const url = new URL(location.pathname, location.origin);
        url.searchParams.set('challenge', challenge);
        const escaped = game.results.filter(result => result.escaped).length;
        const pattern = game.results.map(result => result.escaped ? '🟩' : '🟪');
        return `OUTCLICK THE ORACLE · ${challenge} · v1\n${game.score}/3000 surprise points · ${escaped}/30 escapes\n${[0, 10, 20].map(start => pattern.slice(start, start + 10).join('')).join('\n')}\nA 107-parameter neural net tried to predict me. Can you beat my score against the same starting brain?\n${url.href}`;
    }

    function finish() {
        document.querySelectorAll('[data-choice]').forEach(button => { button.disabled = true; });
        const escapes = game.results.filter(result => result.escaped).length;
        $('result-title').textContent = `${game.score.toLocaleString()} points. ${escapes >= 23 ? 'Beautiful chaos.' : escapes >= 17 ? 'Hard to pin down.' : 'The Oracle found a pattern.'}`;
        $('result-summary').textContent = `${escapes}/30 escapes · Longest escape streak: ${game.bestStreak}. Replay the same brain or send a friend the challenge.`;
        $('result').hidden = false;
        $('result-title').focus({ preventScroll: true });
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
        $('score').textContent = game.score.toLocaleString();
        $('round').textContent = `${game.results.length} / 30`;
        $('streak').textContent = String(game.streak);
        $('feedback').textContent = `${result.escaped ? 'Escaped!' : 'Predicted!'} It guessed ${names[result.prediction]}; you chose ${names[choice]}. +${result.points} points.`;
        const marker = $('history').children[game.results.length - 1];
        marker.className = result.escaped ? 'escaped' : 'caught';
        marker.title = `Move ${game.results.length}: ${names[choice]}, ${result.escaped ? 'escaped' : 'predicted'}, +${result.points}`;
        marker.setAttribute('aria-label', marker.title);
        $('inspect-output').value = String(choice);
        updateLab(); animate();
        if (game.results.length === 30) finish();
    }

    function reset() {
        cancelAnimationFrame(frame);
        game = new NeuralOracle.Game(seed); last = null;
        $('score').textContent = '0'; $('round').textContent = '0 / 30'; $('streak').textContent = '0';
        $('result').hidden = true; $('share-fallback').hidden = true; $('share-status').textContent = '';
        $('feedback').textContent = 'Pick any symbol. The Oracle predicts first, then learns from your click.';
        $('best').textContent = `Best on this device: ${best ? best.toLocaleString() : '—'}`;
        $('history').replaceChildren(...Array.from({ length: 30 }, (_, i) => {
            const marker = document.createElement('span'); marker.setAttribute('aria-label', `Move ${i + 1}: not played`); return marker;
        }));
        document.querySelectorAll('[data-choice]').forEach(button => { button.disabled = false; });
        updateLab(); draw();
    }

    document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => play(Number(button.dataset.choice))));
    document.addEventListener('keydown', event => {
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        if (/^[123]$/.test(event.key) && game.results.length < 30) { event.preventDefault(); play(Number(event.key) - 1); }
    });
    $('restart').addEventListener('click', () => { reset(); document.querySelector('[data-choice]').focus({ preventScroll: true }); });
    $('inspect-output').addEventListener('change', inspect);
    $('share').addEventListener('click', async () => {
        const text = shareText();
        try {
            await navigator.clipboard.writeText(text);
            $('share-status').textContent = 'Copied! Paste it into a post or send it to a friend.';
        } catch (_) {
            $('share-fallback').value = text; $('share-fallback').hidden = false;
            $('share-fallback').focus(); $('share-fallback').select();
            $('share-status').textContent = 'Clipboard unavailable. Copy the selected challenge below.';
        }
    });
    new ResizeObserver(() => draw()).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(frame); else draw(); });
    reducedMotion.addEventListener('change', () => { cancelAnimationFrame(frame); draw(); });
    reset();
})();
