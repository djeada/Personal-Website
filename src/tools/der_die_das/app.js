(function() {
    "use strict";

    const Rules = window.DDDRules;
    const Srs = window.DDDSrs;
    const $ = (id) => document.getElementById(id);

    const GENDERS = ["m", "f", "n"];
    const ARTICLE = {
        m: "der",
        f: "die",
        n: "das"
    };
    const GENDER_NAME = {
        m: "masculine",
        f: "feminine",
        n: "neuter"
    };
    const LEVELS = [{
        id: 1,
        name: "Essentials"
    }, {
        id: 2,
        name: "Core"
    }, {
        id: 3,
        name: "Expanding"
    }, {
        id: 4,
        name: "Advanced"
    }];
    const MODES = {
        classic: {
            name: "Classic",
            lives: 3,
            ramp: true,
            freeze: 1700
        },
        time: {
            name: "Time attack",
            clock: 60,
            penalty: 3,
            ramp: true,
            freeze: 900
        },
        practice: {
            name: "Practice",
            words: 20,
            wait: true
        }
    };
    const PACES = {
        relaxed: {
            label: "Relaxed",
            fall: 9500
        },
        normal: {
            label: "Normal",
            fall: 6800
        },
        fast: {
            label: "Fast",
            fall: 4800
        }
    };
    const MEANINGS = {
        show: "Shown",
        tap: "Tap to reveal",
        off: "Off"
    };
    const WORDS_PER_LEVEL = 8;
    const MAX_LIVES = 5;
    const RAMP = 0.88;
    const MIN_FALL = 1900;
    const DROP_SPEED = 7;
    const BONUS_EVERY = 7;
    const STORE_KEY = "ddd:v2";
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");

    const els = {
        stage: $("stage"),
        canvas: $("gameCanvas"),
        announce: $("announce"),
        start: $("startScreen"),
        pause: $("pauseScreen"),
        over: $("overScreen"),
        bonus: $("bonusForm"),
        startButton: $("startButton"),
        pauseButton: $("pauseButton"),
        soundButton: $("soundButton")
    };
    const ctx = els.canvas.getContext("2d");


    function readStore() {
        try {
            const data = JSON.parse(window.localStorage.getItem(STORE_KEY) || "null");
            return data && data.v === 2 ? data : null;
        } catch (error) {
            return null;
        }
    }

    const saved = readStore() || {};
    const state = {
        settings: Object.assign({
            mode: "classic",
            levels: [1],
            pace: "normal",
            meaning: "tap",
            bonus: true,
            speak: false,
            patterns: false,
            sound: true
        }, saved.settings || {}),
        progress: Object.assign(Srs.blank(), saved.progress || {}),
        best: saved.best || {},
        totals: Object.assign({
            games: 0,
            answers: 0,
            right: 0,
            bestStreak: 0
        }, saved.totals || {})
    };

    function persist() {
        try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify({
                v: 2,
                settings: state.settings,
                progress: state.progress,
                best: state.best,
                totals: state.totals
            }));
        } catch (error) {

        }
    }


    let entries = [];
    let byId = new Map();
    let rules = null;

    function parseWords(data) {
        entries = data.words.map((row, rank) => {
            const [word, articles, plural, meaning, level, extra = {}] = row;
            return {
                id: `${word}|${articles}`,
                word,
                articles,
                genders: articles.split(""),
                variants: (extra.v || "").split("").filter(Boolean),
                variantNote: extra.vn || "",
                plural,
                meaning,
                level,
                homograph: Boolean(extra.d),
                inf: Boolean(extra.i),
                rank
            };
        });
        byId = new Map(entries.map((entry) => [entry.id, entry]));
        rules = Rules.create(entries);
    }

    function judge(entry, gender) {
        if (entry.genders.includes(gender)) return "right";
        if (entry.variants.includes(gender)) return "variant";
        return "wrong";
    }

    function phrase(entry, gender) {
        return `${ARTICLE[gender || entry.genders[0]]} ${entry.word}`;
    }

    function pluralText(entry) {
        if (entry.plural === "-") return "no plural";
        if (!entry.plural) return "";
        return `die ${entry.plural}`;
    }

    function levelName(id) {
        return (LEVELS.find((level) => level.id === id) || LEVELS[0]).name;
    }


    const Sound = (() => {
        let audio = null;

        function context() {
            const Context = window.AudioContext || window.webkitAudioContext;
            if (!Context) return null;
            if (!audio) audio = new Context();
            if (audio.state === "suspended") audio.resume();
            return audio;
        }

        function tone(freq, start, duration, type = "triangle", gain = 0.07, endFreq = 0) {
            if (!state.settings.sound) return;
            const audioContext = context();
            if (!audioContext) return;
            const t = audioContext.currentTime + start;
            const osc = audioContext.createOscillator();
            const amp = audioContext.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
            amp.gain.setValueAtTime(0.0001, t);
            amp.gain.exponentialRampToValueAtTime(gain, t + 0.012);
            amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
            osc.connect(amp);
            amp.connect(audioContext.destination);
            osc.start(t);
            osc.stop(t + duration + 0.03);
        }

        return {
            unlock() {
                if (state.settings.sound) context();
            },
            right(streak) {
                const base = 523.25 * Math.pow(2, Math.min(streak, 12) / 24);
                tone(base, 0, 0.09);
                tone(base * 1.5, 0.07, 0.15);
            },
            wrong() {
                tone(220, 0, 0.26, "square", 0.045, 110);
            },
            level() {
                [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tone(freq, i * 0.07, 0.18));
            },
            bonus() {
                [659.25, 987.77, 1318.5].forEach((freq, i) => tone(freq, i * 0.06, 0.16));
            },
            tick() {
                tone(1320, 0, 0.035, "square", 0.02);
            },
            over() {
                [392, 329.63, 261.63].forEach((freq, i) => tone(freq, i * 0.17, 0.28, "square", 0.035));
            }
        };
    })();


    const Speech = (() => {
        const synth = window.speechSynthesis;
        const listeners = [];
        let voice = null;

        function pick() {
            if (!synth) return;
            const voices = synth.getVoices();
            voice = voices.find((v) => /^de[-_]DE/i.test(v.lang) && /google|natural|premium|enhanced|neural/i.test(v.name)) ||
                voices.find((v) => /^de[-_]DE/i.test(v.lang)) ||
                voices.find((v) => /^de/i.test(v.lang)) || null;
            listeners.forEach((fn) => fn(Boolean(voice)));
        }

        if (synth && window.SpeechSynthesisUtterance) {
            pick();
            if (synth.addEventListener) synth.addEventListener("voiceschanged", pick);
        }

        return {
            onChange(fn) {
                listeners.push(fn);
                fn(Boolean(voice));
            },
            say(text) {
                if (!voice || !text) return;
                synth.cancel();
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.voice = voice;
                utterance.lang = voice.lang;
                utterance.rate = 0.92;
                synth.speak(utterance);
            }
        };
    })();


    let W = 0;
    let H = 0;
    let dpr = 1;
    let colors = {};
    let background = null;

    function readColors() {
        const p = ToolShared.palette();
        const style = getComputedStyle(document.body);
        const font = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
        colors = {
            canvas: p.canvas,
            grid: p.grid,
            panel: p.panel,
            panel2: p.panel2,
            rule: p.rule,
            ruleStrong: p.ruleStrong,
            ink: p.ink,
            ink2: p.ink2,
            ink3: p.ink3,
            accent: p.gold,
            onAccent: p.onGold,
            rose: p.rose,
            verdigris: p.verdigris,
            m: p.gold,
            f: p.rose,
            n: p.verdigris,
            sans: font("--g-font-sans", "sans-serif"),
            mono: font("--g-font-mono", "monospace")
        };
        background = null;
    }

    function layout() {
        const compact = W < 560;
        const binH = compact ? 84 : 102;
        return {
            compact,
            binH,
            pad: compact ? 5 : 10,
            laneW: W / 3,
            binTop: H - binH,
            wordSize: compact ? 25 : 36,
            meaningSize: compact ? 13 : 15,
            metaSize: compact ? 9 : 10
        };
    }

    function laneCenter(lane) {
        return (lane + 0.5) * (W / 3);
    }

    function laneAt(x) {
        return Math.max(0, Math.min(2, Math.floor(x / (W / 3))));
    }

    function resize() {
        const rect = els.stage.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const oldW = W;
        W = Math.max(1, Math.round(rect.width));
        H = Math.max(1, Math.round(rect.height));
        els.canvas.width = Math.round(W * dpr);
        els.canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        background = null;
        if (game && game.word && oldW) {
            const scale = W / oldW;
            game.word.x *= scale;
            game.word.targetX *= scale;
        }
        draw(performance.now());
    }

    function drawBackground(L) {
        if (!background || background.w !== W || background.h !== H) {
            const off = document.createElement("canvas");
            off.width = Math.round(W * dpr);
            off.height = Math.round(H * dpr);
            const g = off.getContext("2d");
            g.setTransform(dpr, 0, 0, dpr, 0, 0);
            g.fillStyle = colors.canvas;
            g.fillRect(0, 0, W, H);
            g.strokeStyle = colors.grid;
            g.lineWidth = 1;
            for (let i = 1; i < 3; i++) {
                const x = Math.round(i * L.laneW) + 0.5;
                g.beginPath();
                g.moveTo(x, 0);
                g.lineTo(x, L.binTop);
                g.stroke();
            }
            g.strokeStyle = colors.rule;
            for (let y = 10; y < L.binTop - 4; y += 10) {
                const major = y % 50 === 0;
                g.beginPath();
                g.moveTo(0, y + 0.5);
                g.lineTo(major ? 9 : 4, y + 0.5);
                g.moveTo(W, y + 0.5);
                g.lineTo(W - (major ? 9 : 4), y + 0.5);
                g.stroke();
            }
            background = {
                canvas: off,
                w: W,
                h: H
            };
        }
        ctx.drawImage(background.canvas, 0, 0, W, H);
    }

    function drawPattern(index, x, y, w, h, color) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        if (index === 0) {
            for (let i = 8; i < w; i += 10) {
                ctx.beginPath();
                ctx.moveTo(x + i + 0.5, y);
                ctx.lineTo(x + i + 0.5, y + h);
                ctx.stroke();
            }
        } else if (index === 1) {
            for (let dy = 6; dy < h; dy += 12) {
                for (let dx = 6; dx < w; dx += 12) ctx.fillRect(x + dx - 1.5, y + dy - 1.5, 3, 3);
            }
        } else {
            for (let i = -h; i < w + h; i += 12) {
                ctx.beginPath();
                ctx.moveTo(x + i, y);
                ctx.lineTo(x + i + h, y + h);
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function drawBins(L, now) {
        const word = game && game.word;
        const targetLane = word && game.status === "playing" ? laneAt(word.targetX) : -1;
        GENDERS.forEach((gender, i) => {
            const x = i * L.laneW + L.pad;
            const y = L.binTop + L.pad / 2;
            const w = L.laneW - L.pad * 2;
            const h = L.binH - L.pad;
            const color = colors[gender];
            const flash = game && game.flash && game.flash.lane === i && now < game.flash.until ? game.flash : null;
            const reveal = game && game.reveal && game.reveal.lane === i && now < game.reveal.until;
            const flashColor = flash ? (flash.ok ? colors.verdigris : colors.rose) : "";
            const targeted = i === targetLane;

            ctx.fillStyle = colors.panel;
            ctx.fillRect(x, y, w, h);
            if (flash || targeted || reveal) {
                ctx.globalAlpha = flash ? 0.16 : 0.09;
                ctx.fillStyle = flash ? flashColor : reveal ? colors.verdigris : color;
                ctx.fillRect(x, y, w, h);
                ctx.globalAlpha = 1;
            }
            if (state.settings.patterns) drawPattern(i, x, y, w, h, color);
            ctx.strokeStyle = flash ? flashColor : reveal ? colors.verdigris : targeted ? color : colors.rule;
            ctx.lineWidth = reveal ? 2 : 1;
            ctx.strokeRect(x + (reveal ? 1 : 0.5), y + (reveal ? 1 : 0.5), w - (reveal ? 2 : 1), h - (reveal ? 2 : 1));
            ctx.lineWidth = 1;
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, targeted || flash ? 4 : 2);

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = colors.ink;
            ctx.font = `600 ${L.compact ? 25 : 33}px ${colors.sans}`;
            ctx.fillText(ARTICLE[gender], x + w / 2, y + h / 2 - (L.compact ? 7 : 9));
            ctx.font = `500 ${L.compact ? 9 : 11}px ${colors.mono}`;
            ctx.fillStyle = flash ? flashColor : reveal ? colors.verdigris : colors.ink3;
            const label = flash ? (flash.ok ? "RIGHT" : "NOT HERE") : reveal ? "HERE" : GENDER_NAME[gender].toUpperCase();
            ctx.fillText(label, x + w / 2, y + h / 2 + (L.compact ? 17 : 21));
            if (!L.compact && game) {
                ctx.textAlign = "left";
                ctx.fillStyle = colors.ink3;
                ctx.fillText(String(i + 1), x + 10, y + 16);
            }
        });
    }

    function meaningLine(word) {
        const entry = word.entry;
        if (entry.homograph) return entry.meaning;
        if (state.settings.meaning === "off") return "";
        if (state.settings.meaning === "show" || word.revealed) return entry.meaning;
        return coarse.matches ? "tap for the meaning" : "press M for the meaning";
    }

    function cardBox(word, L) {
        const meaning = meaningLine(word);
        ctx.font = `600 ${L.wordSize}px ${colors.sans}`;
        const wordW = ctx.measureText(word.entry.word).width;
        ctx.font = `400 ${L.meaningSize}px ${colors.sans}`;
        const meaningW = meaning ? ctx.measureText(meaning).width : 0;
        const padX = L.compact ? 14 : 22;
        const inner = Math.max(wordW, meaningW, L.compact ? 80 : 110);
        const w = Math.min(W - 12, inner + padX * 2);
        const h = (L.compact ? 22 : 26) + L.wordSize + (meaning ? L.meaningSize + 10 : 0) + (L.compact ? 14 : 18);
        return {
            w,
            h,
            meaning
        };
    }

    function clampX(x, w) {
        return Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, x));
    }

    function truncate(text, max) {
        if (ctx.measureText(text).width <= max) return text;
        let cut = text;
        while (cut.length > 4 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
        return `${cut}…`;
    }

    const SOURCE_LABEL = {
        new: "NEW WORD",
        due: "REVIEW",
        retry: "ONE MORE TIME",
        review: "PRACTICE",
        rule: "RULE",
        mistake: "YOUR MISTAKE"
    };

    function drawCard(word, L, now) {
        const box = cardBox(word, L);
        word.w = box.w;
        word.h = box.h;
        const cx = clampX(word.x, box.w);
        const left = Math.round(cx - box.w / 2);
        const top = Math.round(word.y - box.h / 2);

        if (game.status === "playing" && !calm.matches) {
            const lane = laneAt(word.targetX);
            ctx.save();
            ctx.strokeStyle = colors[GENDERS[lane]];
            ctx.globalAlpha = 0.45;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.moveTo(Math.round(laneCenter(lane)) + 0.5, top + box.h + 4);
            ctx.lineTo(Math.round(laneCenter(lane)) + 0.5, L.binTop - 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = colors.panel;
        ctx.fillRect(left, top, box.w, box.h);
        ctx.strokeStyle = colors.ruleStrong;
        ctx.lineWidth = 1;
        ctx.strokeRect(left + 0.5, top + 0.5, box.w - 1, box.h - 1);

        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        ctx.font = `500 ${L.metaSize}px ${colors.mono}`;
        ctx.fillStyle = word.source === "retry" || word.source === "mistake" ? colors.rose : colors.ink3;
        const metaLeft = SOURCE_LABEL[word.source] || "";
        ctx.fillText(metaLeft, left + 10, top + 8);
        ctx.textAlign = "right";
        ctx.fillStyle = colors.ink3;
        ctx.fillText(levelName(word.entry.level).toUpperCase(), left + box.w - 10, top + 8);

        ctx.textAlign = "center";
        ctx.fillStyle = colors.ink;
        ctx.font = `600 ${L.wordSize}px ${colors.sans}`;
        const wordTop = top + (L.compact ? 20 : 24);
        ctx.fillText(truncate(word.entry.word, box.w - 16), cx, wordTop);
        if (box.meaning) {
            ctx.font = `400 ${L.meaningSize}px ${colors.sans}`;
            const placeholder = !word.revealed && state.settings.meaning === "tap" && !word.entry.homograph;
            ctx.fillStyle = placeholder ? colors.ink3 : colors.ink2;
            ctx.fillText(truncate(box.meaning, box.w - 16), cx, wordTop + L.wordSize + 8);
        }
    }

    function drawCorrection(L) {
        const c = game.correction;
        const entry = c.entry;
        const gender = entry.genders[0];
        const text = phrase(entry, gender);
        ctx.font = `600 ${L.wordSize}px ${colors.sans}`;
        const textW = ctx.measureText(text).width;
        const sub = [pluralText(entry), entry.meaning].filter(Boolean).join("  ·  ");
        ctx.font = `400 ${L.meaningSize}px ${colors.sans}`;
        const subW = ctx.measureText(sub).width;
        const w = Math.min(W - 12, Math.max(textW, subW) + 40);
        const h = L.wordSize + L.meaningSize + (L.compact ? 46 : 54);
        const cx = clampX(laneCenter(c.lane), w);
        const top = Math.round(L.binTop - h - (L.compact ? 14 : 22));
        const left = Math.round(cx - w / 2);
        ctx.fillStyle = colors.panel;
        ctx.fillRect(left, top, w, h);
        ctx.strokeStyle = colors.verdigris;
        ctx.strokeRect(left + 0.5, top + 0.5, w - 1, h - 1);
        ctx.fillStyle = colors.verdigris;
        ctx.fillRect(left, top, w, 2);

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = `500 ${L.metaSize}px ${colors.mono}`;
        ctx.fillStyle = colors.ink3;
        ctx.fillText(game.mode.wait ? "IT IS · PRESS SPACE OR TAP TO GO ON" : "IT IS", cx, top + 9);
        ctx.font = `600 ${L.wordSize}px ${colors.sans}`;
        const articleW = ctx.measureText(`${ARTICLE[gender]} `).width;
        const start = cx - textW / 2;
        ctx.textAlign = "left";
        ctx.fillStyle = colors[gender];
        ctx.fillText(`${ARTICLE[gender]} `, start, top + (L.compact ? 22 : 26));
        ctx.fillStyle = colors.ink;
        ctx.fillText(entry.word, start + articleW, top + (L.compact ? 22 : 26));
        ctx.textAlign = "center";
        ctx.font = `400 ${L.meaningSize}px ${colors.sans}`;
        ctx.fillStyle = colors.ink2;
        ctx.fillText(truncate(sub, w - 20), cx, top + (L.compact ? 26 : 32) + L.wordSize);
    }

    function drawEffects(L, now) {
        game.particles = game.particles.filter((p) => now - p.born < p.life);
        game.particles.forEach((p) => {
            const t = (now - p.born) / 1000;
            const k = 1 - (now - p.born) / p.life;
            ctx.globalAlpha = Math.max(0, k);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x + p.vx * t, p.y + p.vy * t + 260 * t * t, p.size, p.size);
        });
        ctx.globalAlpha = 1;

        game.floaters = game.floaters.filter((f) => now - f.born < 900);
        game.floaters.forEach((f) => {
            const k = (now - f.born) / 900;
            ctx.globalAlpha = 1 - k;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `600 ${L.compact ? 15 : 18}px ${colors.mono}`;
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x, f.y - (calm.matches ? 0 : 36 * k));
        });
        ctx.globalAlpha = 1;

        if (game.banner && now < game.banner.until) {
            const k = (game.banner.until - now) / 1400;
            ctx.globalAlpha = Math.min(1, k * 3);
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `500 ${L.compact ? 11 : 12}px ${colors.mono}`;
            ctx.fillStyle = colors.accent;
            ctx.fillText(game.banner.kicker, W / 2, H * 0.3 - (L.compact ? 22 : 28));
            ctx.font = `600 ${L.compact ? 30 : 42}px ${colors.sans}`;
            ctx.fillStyle = colors.ink;
            ctx.fillText(game.banner.text, W / 2, H * 0.3);
            ctx.globalAlpha = 1;
        }

        if (game.mode.clock) {
            const share = Math.max(0, game.clock / game.mode.clock);
            ctx.fillStyle = game.clock < 10 ? colors.rose : colors.accent;
            ctx.fillRect(0, 0, W * share, 2);
        }
    }

    function drawHint(L) {
        if (game.status !== "playing" || state.totals.answers > 2 || game.answers > 2) return;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.font = `500 ${L.compact ? 10 : 11}px ${colors.mono}`;
        ctx.fillStyle = colors.ink3;
        ctx.fillText(coarse.matches ? "TAP THE BOX THE WORD BELONGS IN" : "PRESS 1, 2 OR 3, OR CLICK A BOX", W / 2, L.binTop - 10);
    }

    function drawIdle(L) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `600 ${L.wordSize}px ${colors.sans}`;
        ctx.fillStyle = colors.ink3;
        ctx.globalAlpha = 0.35;
        ctx.fillText("Zeitung", laneCenter(1), L.binTop * 0.42);
        ctx.globalAlpha = 1;
    }

    function draw(now) {
        if (!W || !H || !colors.canvas) return;
        const L = layout();
        ctx.clearRect(0, 0, W, H);
        drawBackground(L);
        if (!game) {
            drawIdle(L);
        } else if (game.correction) {
            drawCorrection(L);
        } else if (game.word) {
            drawCard(game.word, L, now);
        }
        drawBins(L, now);
        if (game) {
            drawHint(L);
            drawEffects(L, now);
        }
    }


    let game = null;
    let rafId = 0;
    let lastFrame = 0;

    function buildPool(options) {
        const day = Srs.today();
        let pool;
        if (options.words) {
            pool = options.words.slice();
        } else {
            const levels = new Set(state.settings.levels);
            pool = entries.filter((entry) => levels.has(entry.level));
        }
        const due = [];
        const fresh = [];
        const seen = [];
        pool.forEach((entry) => {
            const card = Srs.card(state.progress, entry.id);
            if (!card) fresh.push(entry);
            else if (card.due <= day) due.push([entry, card]);
            else seen.push([entry, card]);
        });
        due.sort((a, b) => a[1].due - b[1].due || b[1].wrong - a[1].wrong);
        seen.sort((a, b) => a[1].step - b[1].step || a[1].due - b[1].due);
        return {
            pool,
            due: due.map(([entry]) => entry),
            fresh,
            seen: seen.map(([entry]) => entry),
            fixed: options.words ? Srs.shuffle(options.words) : null
        };
    }

    function newGame(options = {}) {
        const modeKey = options.mode || state.settings.mode;
        const mode = MODES[modeKey];
        const pools = buildPool(options);
        if (!pools.pool.length) return null;
        return {
            key: modeKey,
            mode,
            label: options.label || mode.name,
            source: options.source || "",
            pools,
            status: "playing",
            score: 0,
            lives: mode.lives || 0,
            clock: mode.clock || 0,
            streak: 0,
            bestStreak: 0,
            level: 1,
            levelProgress: 0,
            answers: 0,
            right: 0,
            spawned: 0,
            unique: new Set(),
            budget: options.words ? Math.min(options.words.length, 20) : mode.words || Infinity,
            retry: [],
            recent: [],
            history: [],
            missed: new Map(),
            sinceBonus: 0,
            word: null,
            correction: null,
            flash: null,
            reveal: null,
            banner: null,
            particles: [],
            floaters: [],
            nextAt: performance.now() + 450,
            freezeUntil: 0,
            pausedAt: 0,
            started: Date.now()
        };
    }

    function fallTime() {
        const base = PACES[state.settings.pace].fall;
        if (!game.mode.ramp) return base;
        return Math.max(MIN_FALL, base * Math.pow(RAMP, game.level - 1));
    }

    function pickEntry() {
        const g = game;
        const pools = g.pools;
        const due = g.retry.findIndex((item) => item.at <= g.spawned);
        if (due >= 0) return {
            entry: g.retry.splice(due, 1)[0].entry,
            source: "retry"
        };
        if (g.unique.size >= g.budget) {
            if (g.retry.length) return {
                entry: g.retry.shift().entry,
                source: "retry"
            };
            return null;
        }
        const recent = new Set(g.recent);
        const lastGenders = g.recent.slice(-3).map((id) => (byId.get(id) || {}).articles);
        const ok = (entry) => entry && !recent.has(entry.id) &&
            !(lastGenders.length === 3 && lastGenders.every((a) => a === entry.articles));
        const take = (list, window) => {
            for (let tries = 0; tries < 8 && list.length; tries++) {
                const index = Math.floor(Math.random() * Math.min(window, list.length));
                if (ok(list[index]) || tries === 7) return list.splice(index, 1)[0];
            }
            return null;
        };

        if (pools.fixed) {
            const entry = take(pools.fixed, pools.fixed.length);
            return entry ? {
                entry,
                source: g.source || "review"
            } : null;
        }
        if (pools.due.length && (Math.random() < 0.45 || !pools.fresh.length)) {
            const entry = take(pools.due, 4);
            if (entry) return {
                entry,
                source: "due"
            };
        }
        if (pools.fresh.length && (Math.random() < 0.75 || !pools.seen.length)) {
            const entry = take(pools.fresh, 14);
            if (entry) return {
                entry,
                source: "new"
            };
        }
        if (pools.seen.length) {
            const entry = take(pools.seen, 12);
            if (entry) {
                pools.seen.push(entry);
                return {
                    entry,
                    source: "review"
                };
            }
        }
        const any = take(pools.pool.slice(), pools.pool.length);
        return any ? {
            entry: any,
            source: "review"
        } : null;
    }

    function spawn(now) {
        const pick = pickEntry();
        if (!pick) {
            endGame("done");
            return;
        }
        const L = layout();
        const lane = Math.floor(Math.random() * 3);
        const word = {
            entry: pick.entry,
            source: pick.source,
            x: laneCenter(lane),
            targetX: laneCenter(lane),
            y: 0,
            w: 0,
            h: 0,
            revealed: false,
            dropping: false,
            answeredAt: null,
            born: now
        };
        const box = cardBox(word, L);
        word.y = -box.h / 2;
        word.w = box.w;
        word.h = box.h;
        game.word = word;
        game.spawned += 1;
        game.unique.add(pick.entry.id);
        game.recent.push(pick.entry.id);
        if (game.recent.length > 12) game.recent.shift();
        const meaning = pick.entry.homograph || state.settings.meaning === "show" ? `, ${pick.entry.meaning}` : "";
        announce(`${pick.entry.word}${meaning}`);
    }

    function steer(lane, drop) {
        if (!game || game.status !== "playing" || !game.word || game.word.landed) return;
        const word = game.word;
        word.targetX = laneCenter(lane);
        if (calm.matches) word.x = word.targetX;
        if (drop) dropWord();
    }

    function nudge(direction) {
        if (!game || !game.word) return;
        steer(Math.max(0, Math.min(2, laneAt(game.word.targetX) + direction)), false);
    }

    function dropWord() {
        if (!game || game.status !== "playing" || !game.word) return;
        const word = game.word;
        if (!word.dropping) {
            word.dropping = true;
            word.answeredAt = Math.max(0, word.y) / Math.max(1, layout().binTop);
        }
    }

    function update(dt, now) {
        const g = game;
        if (g.status === "frozen") {
            if (!g.mode.wait && now >= g.freezeUntil) resumeAfterCorrection(now);
            return;
        }
        if (g.status !== "playing") return;

        if (g.mode.clock) {
            const before = Math.ceil(g.clock);
            g.clock -= dt / 1000;
            if (Math.ceil(g.clock) !== before && g.clock < 5.5 && g.clock > 0) Sound.tick();
            if (g.clock <= 0) {
                g.clock = 0;
                updateHud();
                endGame("time");
                return;
            }
            updateClock();
        }

        if (!g.word) {
            if (now >= g.nextAt) spawn(now);
            return;
        }

        const L = layout();
        const word = g.word;
        if (!word.dragging) {
            const k = calm.matches ? 1 : Math.min(1, dt / 70);
            word.x += (word.targetX - word.x) * k;
            if (Math.abs(word.targetX - word.x) < 0.5) word.x = word.targetX;
        }
        const travel = L.binTop + word.h / 2;
        const speed = travel / fallTime();
        word.y += speed * dt * (word.dropping ? DROP_SPEED : 1);
        if (word.y + word.h / 2 >= L.binTop) {
            word.y = L.binTop - word.h / 2;
            land(now);
        }
    }

    function multiplier(streak) {
        return Math.min(4, 1 + Math.floor(streak / 5));
    }

    function burst(x, y, color) {
        if (calm.matches) return;
        for (let i = 0; i < 12; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
            const speed = 120 + Math.random() * 180;
            game.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 3 + Math.random() * 3,
                color,
                born: performance.now(),
                life: 600 + Math.random() * 300
            });
        }
    }

    function land(now) {
        const g = game;
        const word = g.word;
        const entry = word.entry;
        const lane = laneAt(word.targetX);
        const gender = GENDERS[lane];
        const verdict = judge(entry, gender);
        const correct = verdict !== "wrong";
        const L = layout();
        const day = Srs.today();

        g.answers += 1;
        state.totals.answers += 1;
        Srs.record(state.progress, entry.id, correct, day);
        g.history.push({
            entry,
            chosen: gender,
            correct,
            verdict,
            source: word.source
        });
        g.word = null;

        if (correct) {
            g.right += 1;
            state.totals.right += 1;
            g.streak += 1;
            g.bestStreak = Math.max(g.bestStreak, g.streak);
            const speedBonus = word.answeredAt === null ? 0 : Math.round(10 * (1 - Math.min(1, word.answeredAt)));
            const points = (10 + speedBonus) * multiplier(g.streak);
            g.score += points;
            g.flash = {
                lane,
                ok: true,
                until: now + 520
            };
            g.floaters.push({
                text: `+${points}`,
                x: laneCenter(lane),
                y: L.binTop - 18,
                color: colors.verdigris,
                born: now
            });
            burst(laneCenter(lane), L.binTop, colors[gender]);
            Sound.right(g.streak);
            g.sinceBonus += 1;
            if (g.mode.ramp) {
                g.levelProgress += 1;
                if (g.levelProgress >= WORDS_PER_LEVEL) levelUp(now);
            }
            g.nextAt = now + 260;
            showLast(entry, gender, verdict);
            announce(`Right. ${phrase(entry, gender)}.`);
            if (state.settings.speak) Speech.say(phrase(entry, gender));
            updateHud();
            persist();
            if (state.settings.bonus && g.sinceBonus >= BONUS_EVERY && entry.plural && entry.plural !== "-") {
                g.sinceBonus = 0;
                openBonus(entry);
            }
            return;
        }

        g.streak = 0;
        if (g.mode.lives) g.lives -= 1;
        if (g.mode.penalty) g.clock = Math.max(0, g.clock - g.mode.penalty);
        const correctLane = GENDERS.indexOf(entry.genders[0]);
        const hold = g.mode.wait ? 1e12 : g.mode.freeze;
        g.flash = {
            lane,
            ok: false,
            until: now + Math.min(hold, 1800)
        };
        g.reveal = {
            lane: correctLane,
            until: now + hold
        };
        if (g.mode.penalty) {
            g.floaters.push({
                text: `-${g.mode.penalty}s`,
                x: laneCenter(lane),
                y: L.binTop - 18,
                color: colors.rose,
                born: now
            });
        }
        const record = g.missed.get(entry.id) || {
            entry,
            chosen: gender
        };
        g.missed.set(entry.id, record);
        g.retry.push({
            entry,
            at: g.spawned + 3 + Math.floor(Math.random() * 3)
        });
        g.correction = {
            entry,
            lane: correctLane
        };
        g.status = "frozen";
        g.freezeUntil = now + hold;
        Sound.wrong();
        showLast(entry, gender, verdict);
        announce(`Not ${ARTICLE[gender]}. It is ${phrase(entry)}. ${rules.explain(entry).text}`);
        if (state.settings.speak) Speech.say(phrase(entry));
        updateHud();
        persist();
    }

    function resumeAfterCorrection(now) {
        const g = game;
        if (!g || g.status !== "frozen") return;
        g.correction = null;
        g.reveal = null;
        g.flash = null;
        if (g.mode.lives && g.lives <= 0) {
            endGame("lives");
            return;
        }
        if (g.mode.clock && g.clock <= 0) {
            endGame("time");
            return;
        }
        g.status = "playing";
        g.nextAt = now + 200;
    }

    function levelUp(now) {
        game.level += 1;
        game.levelProgress = 0;
        game.banner = {
            kicker: "LEVEL UP",
            text: `Level ${game.level}`,
            until: now + 1400
        };
        Sound.level();
        announce(`Level ${game.level}. Words fall faster.`);
    }


    function openBonus(entry) {
        game.status = "bonus";
        game.bonusEntry = entry;
        $("bonusTitle").innerHTML = "";
        $("bonusTitle").append("Plural of ");
        const word = document.createElement("span");
        word.lang = "de";
        word.className = `ddd-a-${entry.genders[0]}`;
        word.textContent = phrase(entry);
        $("bonusTitle").append(word, "?");
        $("bonusInput").value = "";
        $("bonusFeedback").textContent = "";
        $("bonusFeedback").className = "ddd-bonus-feedback";
        els.bonus.hidden = false;
        els.bonus.querySelector('button[type="submit"]').disabled = false;
        window.setTimeout(() => $("bonusInput").focus({
            preventScroll: true
        }), 30);
        updateHud();
    }

    function normalisePlural(text) {
        return text.trim().replace(/^die\s+/i, "").toLowerCase().replace(/ae/g, "ä").replace(/oe/g, "ö").replace(/ue/g, "ü");
    }

    function closeBonus() {
        els.bonus.hidden = true;
        if (!game || game.status !== "bonus") return;
        game.status = "playing";
        game.nextAt = performance.now() + 300;
        els.stage.focus({
            preventScroll: true
        });
        updateHud();
        kick();
    }

    function submitBonus(event) {
        event.preventDefault();
        if (!game || game.status !== "bonus") return;
        const entry = game.bonusEntry;
        const guess = normalisePlural($("bonusInput").value);
        if (!guess) return;
        const answer = entry.plural.toLowerCase();
        const feedback = $("bonusFeedback");
        els.bonus.querySelector('button[type="submit"]').disabled = true;
        if (guess === answer) {
            game.score += 25 * multiplier(game.streak);
            let reward = "";
            if (game.mode.lives) {
                game.lives = Math.min(MAX_LIVES, game.lives + 1);
                reward = " and a life";
            } else if (game.mode.clock) {
                game.clock += 5;
                reward = " and five seconds";
            }
            feedback.textContent = `Right: die ${entry.plural}. Bonus points${reward}.`;
            feedback.className = "ddd-bonus-feedback is-right";
            Sound.bonus();
        } else {
            feedback.textContent = `It is die ${entry.plural}.`;
            feedback.className = "ddd-bonus-feedback is-wrong";
            Sound.wrong();
        }
        updateHud();
        window.setTimeout(closeBonus, guess === answer ? 900 : 1800);
    }


    function pauseGame(reason) {
        if (!game || (game.status !== "playing" && game.status !== "frozen")) return;
        game.pausedFrom = game.status;
        game.pausedAt = performance.now();
        game.status = "paused";
        $("pauseText").textContent = reason || `${game.label} · score ${game.score}. Your game waits here.`;
        els.pause.hidden = false;
        $("resumeButton").focus({
            preventScroll: true
        });
        updateHud();
    }

    function resumeGame() {
        if (!game || game.status !== "paused") return;
        const away = performance.now() - game.pausedAt;
        game.status = game.pausedFrom;
        game.nextAt += away;
        game.freezeUntil += away;
        if (game.flash) game.flash.until += away;
        if (game.reveal) game.reveal.until += away;
        els.pause.hidden = true;
        els.stage.focus({
            preventScroll: true
        });
        updateHud();
        kick();
    }


    function startGame(options = {}) {
        if (!entries.length) return;
        Sound.unlock();
        const fresh = newGame(options);
        if (!fresh) return;
        game = fresh;
        game.options = options;
        els.start.hidden = true;
        els.over.hidden = true;
        els.pause.hidden = true;
        els.bonus.hidden = true;
        els.stage.classList.remove("is-static");
        els.stage.classList.add("is-playing");
        resize();
        $("hudLivesBox").hidden = false;
        $("hudTimeBox").hidden = !game.mode.clock;
        resetLast();
        renderRecap();
        updateHud();
        scrollToGame();
        els.stage.focus({
            preventScroll: true
        });
        lastFrame = performance.now();
        if (!rafId) rafId = window.requestAnimationFrame(loop);
    }

    function endGame(reason) {
        const g = game;
        if (!g || g.status === "over") return;
        g.status = "over";
        g.word = null;
        g.correction = null;
        els.stage.classList.remove("is-playing");
        els.bonus.hidden = true;
        els.pause.hidden = true;
        state.totals.games += 1;
        state.totals.bestStreak = Math.max(state.totals.bestStreak, g.bestStreak);
        const bestKey = g.options && g.options.words ? "" : `${g.key}:${state.settings.levels.join("")}:${state.settings.pace}`;
        const previous = bestKey ? state.best[bestKey] || 0 : 0;
        const isBest = bestKey && g.answers > 0 && g.score > previous;
        if (isBest) state.best[bestKey] = g.score;
        persist();
        if (reason !== "quit") Sound.over();

        const reasons = {
            lives: "Out of lives",
            time: "Time's up",
            done: g.mode.wait || g.options.words ? "Practice complete" : "Every word played",
            quit: "Game ended"
        };
        $("overReason").textContent = `${g.label} · ${reasons[reason] || "Game over"}`;
        $("overTitle").textContent = String(g.score);
        const best = $("overBest");
        best.className = "ddd-over-best" + (isBest ? " is-new" : "");
        best.textContent = !bestKey ? "Points this round" : isBest ? (previous ? `New best, up from ${previous}` : "Your first score on this setting") : `Best ${previous}`;
        const accuracy = g.answers ? Math.round((g.right / g.answers) * 100) : 0;
        const newWords = g.history.filter((h) => h.source === "new" && h.correct).length;
        fillStats($("overStats"), [
            ["Accuracy", g.answers ? `${accuracy}%` : "–"],
            ["Words", String(g.unique.size)],
            ["Best streak", String(g.bestStreak)],
            [g.mode.ramp ? "Level" : "New words", g.mode.ramp ? String(g.level) : String(newWords)]
        ]);
        const missed = $("overMissed");
        missed.innerHTML = "";
        const list = Array.from(g.missed.values());
        if (list.length) {
            const heading = document.createElement("h3");
            heading.textContent = list.length === 1 ? "One word to remember" : `${list.length} words to remember`;
            const ul = document.createElement("ul");
            list.slice(0, 6).forEach(({
                entry
            }) => {
                const li = document.createElement("li");
                const word = document.createElement("span");
                word.lang = "de";
                word.append(articleNode(entry.genders[0]), ` ${entry.word}`);
                const rule = document.createElement("span");
                rule.textContent = `${entry.meaning}. ${rules.explain(entry).text}`;
                li.append(word, rule);
                ul.appendChild(li);
            });
            missed.append(heading, ul);
        }
        $("mistakesButton").hidden = !list.length;
        els.over.hidden = false;
        els.stage.classList.add("is-static");
        renderRecap();
        renderProgress();
        renderModeBests();
        window.setTimeout(() => $("overTitle").focus({
            preventScroll: true
        }), 30);
        announce(`${reasons[reason] || "Game over"}. Score ${g.score}.`);
        updateHud();
    }

    function loop(now) {
        rafId = 0;
        const dt = Math.min(64, now - lastFrame || 16);
        lastFrame = now;
        if (game && game.status !== "over") update(dt, now);
        draw(now);
        const animating = game && (game.status === "playing" || game.status === "frozen" ||
            game.particles.length || game.floaters.length || (game.banner && now < game.banner.until));
        if (animating && !document.hidden) rafId = window.requestAnimationFrame(loop);
    }

    function kick() {
        if (!rafId) {
            lastFrame = performance.now();
            rafId = window.requestAnimationFrame(loop);
        }
    }


    function articleNode(gender) {
        const b = document.createElement("b");
        b.className = `ddd-a-${gender}`;
        b.textContent = ARTICLE[gender];
        return b;
    }

    function fillStats(dl, rows) {
        dl.innerHTML = "";
        rows.forEach(([label, value]) => {
            const box = document.createElement("div");
            const dt = document.createElement("dt");
            const dd = document.createElement("dd");
            dt.textContent = label;
            dd.textContent = value;
            box.append(dt, dd);
            dl.appendChild(box);
        });
    }

    function announce(text) {
        els.announce.textContent = "";
        window.setTimeout(() => {
            els.announce.textContent = text;
        }, 20);
    }

    function updateHud() {
        const g = game;
        $("hudScore").textContent = g ? String(g.score) : "0";
        const lives = $("hudLives");
        lives.innerHTML = "";
        lives.classList.toggle("is-infinite", Boolean(g && !g.mode.lives));
        if (!g || g.mode.lives) {
            const count = g ? g.lives : 3;
            const slots = Math.max(3, count);
            for (let i = 0; i < slots; i++) {
                const life = document.createElement("span");
                life.className = "ddd-life" + (i >= count ? " is-lost" : "");
                lives.appendChild(life);
            }
            lives.setAttribute("aria-label", `${count} ${count === 1 ? "life" : "lives"}`);
        } else {
            lives.setAttribute("aria-label", "No limit");
        }
        $("hudStreak").textContent = g ? String(g.streak) : "0";
        const mult = g ? multiplier(g.streak) : 1;
        $("hudMult").textContent = mult > 1 ? `x${mult}` : "";
        $("hudLevel").textContent = g ? String(g.level) : "1";
        $("hudLevelBar").style.width = g && g.mode.ramp ? `${(g.levelProgress / WORDS_PER_LEVEL) * 100}%` : "0";
        $("hudAccuracy").textContent = g && g.answers ? `${Math.round((g.right / g.answers) * 100)}%` : "–";
        updateClock();
        const active = Boolean(g && ["playing", "frozen", "paused"].includes(g.status));
        els.pauseButton.disabled = !active;
        els.pauseButton.textContent = g && g.status === "paused" ? "Resume" : "Pause";
    }

    function updateClock() {
        const g = game;
        const time = $("hudTime");
        if (!g || !g.mode.clock) return;
        time.textContent = String(Math.ceil(g.clock));
        time.classList.toggle("is-low", g.clock < 10);
    }

    function resetLast() {
        $("lastEmpty").hidden = false;
        ["lastVerdict", "lastAnswer", "lastRule"].forEach((id) => {
            $(id).textContent = "";
        });
        $("speakButton").hidden = true;
    }

    let lastSpoken = "";

    function showLast(entry, chosen, verdict) {
        $("lastEmpty").hidden = true;
        const right = verdict !== "wrong";
        const verdictEl = $("lastVerdict");
        verdictEl.className = "ddd-last-verdict " + (right ? "is-right" : "is-wrong");
        verdictEl.textContent = right ? (verdict === "variant" ? "Right, regionally" : "Right") : `Not ${ARTICLE[chosen]}`;

        const answer = $("lastAnswer");
        answer.innerHTML = "";
        const gender = right ? chosen : entry.genders[0];
        const main = document.createElement("span");
        main.lang = "de";
        main.append(articleNode(gender), ` ${entry.word}`);
        answer.appendChild(main);
        const plural = pluralText(entry);
        if (plural) {
            const sep = document.createElement("span");
            sep.className = "ddd-sep";
            sep.textContent = "·";
            const pl = document.createElement("span");
            pl.lang = "de";
            pl.textContent = plural;
            answer.append(sep, pl);
        }
        const sep = document.createElement("span");
        sep.className = "ddd-sep";
        sep.textContent = "·";
        const meaning = document.createElement("span");
        meaning.className = "ddd-meaning";
        meaning.textContent = entry.meaning;
        answer.append(sep, meaning);

        const notes = [rules.explain(entry).text];
        if (entry.variants.length) {
            const variant = entry.variants.map((g) => ARTICLE[g]).join(", ");
            notes.push(`Standard German says ${ARTICLE[entry.genders[0]]}; ${variant} is also used (${entry.variantNote}).`);
        }
        $("lastRule").textContent = notes.join(" ");
        lastSpoken = phrase(entry, gender);
        $("speakButton").hidden = !speechReady;
    }


    let speechReady = false;

    function renderSetup() {
        const s = state.settings;
        document.querySelectorAll('input[name="mode"]').forEach((input) => {
            input.checked = input.value === s.mode;
        });

        const levelControl = $("levelControl");
        levelControl.innerHTML = "";
        LEVELS.forEach((level) => {
            const count = entries.filter((entry) => entry.level === level.id).length;
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = String(level.id);
            input.checked = s.levels.includes(level.id);
            input.addEventListener("change", () => {
                const chosen = Array.from(levelControl.querySelectorAll("input:checked")).map((box) => Number(box.value));
                if (!chosen.length) {
                    input.checked = true;
                    return;
                }
                s.levels = chosen;
                persist();
                renderSummary();
                renderModeBests();
            });
            const span = document.createElement("span");
            span.textContent = level.name;
            const small = document.createElement("small");
            small.textContent = count.toLocaleString("en");
            span.appendChild(small);
            label.append(input, span);
            levelControl.appendChild(label);
        });

        segmented($("paceControl"), "pace", Object.entries(PACES).map(([value, pace]) => [value, pace.label]), s.pace, (value) => {
            s.pace = value;
            persist();
            renderSummary();
            renderModeBests();
        });
        segmented($("meaningControl"), "meaning", Object.entries(MEANINGS), s.meaning, (value) => {
            s.meaning = value;
            persist();
        });
        $("optBonus").checked = s.bonus;
        $("optSpeak").checked = s.speak;
        $("optPatterns").checked = s.patterns;
        els.soundButton.setAttribute("aria-pressed", String(s.sound));
        renderSummary();
        renderModeBests();
    }

    function segmented(container, name, options, current, onChange) {
        container.innerHTML = "";
        options.forEach(([value, text]) => {
            const label = document.createElement("label");
            const input = document.createElement("input");
            input.type = "radio";
            input.name = name;
            input.value = value;
            input.checked = value === current;
            input.addEventListener("change", () => onChange(value));
            const span = document.createElement("span");
            span.textContent = text;
            label.append(input, span);
            container.appendChild(label);
        });
    }

    function renderSummary() {
        if (!entries.length) return;
        const levels = new Set(state.settings.levels);
        const pool = entries.filter((entry) => levels.has(entry.level));
        const day = Srs.today();
        let due = 0;
        let fresh = 0;
        pool.forEach((entry) => {
            const card = Srs.card(state.progress, entry.id);
            if (!card) fresh += 1;
            else if (card.due <= day) due += 1;
        });
        const names = LEVELS.filter((level) => levels.has(level.id)).map((level) => level.name);
        const summary = $("startSummary");
        summary.innerHTML = "";
        const strong = document.createElement("strong");
        strong.textContent = `${pool.length.toLocaleString("en")} nouns`;
        summary.append(strong, ` from ${names.join(" and ")}. `);
        const parts = [];
        if (due) parts.push(`${due} due for review`);
        parts.push(`${fresh.toLocaleString("en")} you have not met yet`);
        summary.append(`${parts.join(", ")}. Missed words come back a few words later.`);
    }

    function bestFor(mode) {
        return state.best[`${mode}:${state.settings.levels.join("")}:${state.settings.pace}`] || 0;
    }

    function renderModeBests() {
        document.querySelectorAll("[data-best]").forEach((node) => {
            const best = bestFor(node.dataset.best);
            node.textContent = best ? `Best ${best}` : "No score yet";
        });
    }


    function renderRecap() {
        const recap = $("recap");
        recap.innerHTML = "";
        const history = game ? game.history : [];
        if (!history.length) {
            const empty = document.createElement("p");
            empty.className = "la-empty";
            empty.textContent = "Every word from your game is listed here with its plural, its meaning and the rule behind its gender.";
            recap.appendChild(empty);
            return;
        }
        const seen = new Map();
        history.forEach((item) => {
            const known = seen.get(item.entry.id);
            if (!known) seen.set(item.entry.id, Object.assign({}, item, {
                firstWrong: !item.correct
            }));
            else if (!item.correct) known.firstWrong = true;
        });
        const rows = Array.from(seen.values()).sort((a, b) => Number(b.firstWrong) - Number(a.firstWrong));
        const wrong = rows.filter((row) => row.firstWrong).length;

        const tools = document.createElement("div");
        tools.className = "ddd-recap-tools";
        const count = document.createElement("span");
        count.textContent = `${rows.length} words · ${rows.length - wrong} right first time · ${wrong} missed`;
        const pdf = document.createElement("button");
        pdf.type = "button";
        pdf.className = "la-link";
        pdf.textContent = "Download as PDF";
        pdf.addEventListener("click", exportPdf);
        tools.append(count, pdf);

        const list = document.createElement("ol");
        list.className = "ddd-recap-list";
        rows.forEach((row) => {
            const entry = row.entry;
            const li = document.createElement("li");
            const mark = document.createElement("span");
            mark.className = "ddd-mark" + (row.firstWrong ? " is-wrong" : "");
            mark.textContent = row.firstWrong ? "MISSED" : "RIGHT";
            const word = document.createElement("span");
            word.className = "ddd-recap-word";
            word.lang = "de";
            word.append(articleNode(entry.genders[0]), ` ${entry.word}`);
            const small = document.createElement("small");
            small.lang = "en";
            small.textContent = [pluralText(entry), entry.meaning].filter(Boolean).join(" · ");
            word.appendChild(small);
            const rule = document.createElement("span");
            rule.className = "ddd-recap-rule";
            if (row.firstWrong) {
                const chose = document.createElement("span");
                chose.className = "ddd-chose";
                chose.textContent = `You chose ${ARTICLE[row.chosen]}`;
                rule.appendChild(chose);
            }
            rule.append(rules.explain(entry).text);
            li.append(mark, word, rule);
            list.appendChild(li);
        });
        recap.append(tools, list);
    }

    function renderProgress() {
        const view = $("progressView");
        view.innerHTML = "";
        if (!entries.length) return;
        const day = Srs.today();
        let seen = 0;
        let known = 0;
        let due = 0;
        const perLevel = LEVELS.map((level) => ({
            level,
            total: 0,
            known: 0,
            learning: 0,
            weak: 0
        }));
        entries.forEach((entry) => {
            const row = perLevel[entry.level - 1];
            row.total += 1;
            const card = Srs.card(state.progress, entry.id);
            if (!card) return;
            seen += 1;
            if (card.due <= day) due += 1;
            const status = Srs.status(state.progress, entry.id, day);
            if (status === "known") {
                known += 1;
                row.known += 1;
            } else if (status === "difficult") {
                row.weak += 1;
            } else {
                row.learning += 1;
            }
        });
        const figures = document.createElement("dl");
        figures.className = "ddd-figures";
        fillStats(figures, [
            ["Words met", seen.toLocaleString("en")],
            ["Known", known.toLocaleString("en")],
            ["Due today", due.toLocaleString("en")],
            ["Day streak", String(Srs.streak(state.progress, day))]
        ]);
        view.appendChild(figures);

        const bars = document.createElement("div");
        bars.className = "la-bars";
        perLevel.forEach((row) => {
            const line = document.createElement("div");
            line.className = "la-bar-row";
            const name = document.createElement("span");
            name.className = "la-bar-name";
            name.textContent = `${row.level.name}`;
            const stack = document.createElement("span");
            stack.className = "ddd-stack";
            stack.setAttribute("role", "img");
            stack.setAttribute("aria-label", `${row.known} known, ${row.learning} learning, ${row.weak} recently missed, of ${row.total}`);
            [
                ["is-known", row.known],
                ["is-learning", row.learning],
                ["is-weak", row.weak]
            ].forEach(([cls, value]) => {
                const part = document.createElement("span");
                part.className = cls;
                part.style.width = `${(value / Math.max(1, row.total)) * 100}%`;
                stack.appendChild(part);
            });
            const value = document.createElement("span");
            value.className = "la-bar-value";
            value.textContent = `${row.known} / ${row.total.toLocaleString("en")}`;
            line.append(name, stack, value);
            bars.appendChild(line);
        });
        view.appendChild(bars);

        const legend = document.createElement("p");
        legend.className = "ddd-legend";
        [
            ["is-known", "Known: right several times, next review in two weeks or more"],
            ["is-learning", "Learning"],
            ["is-weak", "Missed recently"]
        ].forEach(([cls, text]) => {
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = text;
            legend.appendChild(span);
        });
        view.appendChild(legend);
        $("replayMistakes").disabled = !Srs.weakest(entries, state.progress, 1).length;
    }

    function renderRules() {
        const view = $("rulesView");
        view.innerHTML = "";
        const all = rules.rules();
        const groups = rules.groups();
        GENDERS.slice().sort((a, b) => "fnm".indexOf(a) - "fnm".indexOf(b)).forEach((gender) => {
            const column = document.createElement("section");
            column.className = `ddd-rule-group ddd-a-${gender}`;
            const heading = document.createElement("h3");
            heading.lang = "de";
            heading.textContent = ARTICLE[gender];
            const small = document.createElement("small");
            small.textContent = GENDER_NAME[gender];
            heading.appendChild(small);
            column.appendChild(heading);

            const items = all.filter((rule) => rule.gender === gender).map((rule) => ({
                id: rule.suffix,
                name: `-${rule.suffix}`,
                share: `${Rules.percent(rule.share)} of ${rule.total}`,
                words: rule.words,
                exceptions: rule.exceptions
            }));
            groups.filter((group) => group.gender === gender && group.entries.length).forEach((group) => items.push({
                id: group.id,
                name: group.title,
                share: `${group.entries.length} nouns`,
                words: group.entries,
                exceptions: []
            }));
            if (gender === "n") {
                const inf = rules.wordsForRule("infinitive");
                if (inf.length) items.push({
                    id: "infinitive",
                    name: "Verbs used as nouns",
                    share: "always",
                    words: inf,
                    exceptions: []
                });
            }
            items.forEach((item) => column.appendChild(ruleRow(item, gender)));
            view.appendChild(column);
        });
    }

    function byLevel(list) {
        return list.slice().sort((a, b) => a.level - b.level || a.rank - b.rank);
    }

    function ruleRow(item, gender) {
        const row = document.createElement("div");
        row.className = "ddd-rule";
        const head = document.createElement("div");
        head.className = "ddd-rule-head";
        const name = document.createElement("span");
        name.className = "ddd-rule-name";
        name.textContent = item.name;
        const share = document.createElement("span");
        share.className = "ddd-rule-share";
        share.textContent = item.share;
        const go = document.createElement("button");
        go.type = "button";
        go.className = "la-link ddd-rule-go";
        go.textContent = "Practise";
        go.setAttribute("aria-label", `Practise ${item.name}`);
        go.addEventListener("click", () => {
            const words = Srs.shuffle(byLevel(item.words).slice(0, 40)).slice(0, 16).concat(byLevel(item.exceptions).slice(0, 4));
            startGame({
                mode: "practice",
                words,
                source: "rule",
                label: `Practice ${item.name}`
            });
        });
        head.append(name, share, go);
        const examples = document.createElement("p");
        examples.className = "ddd-rule-examples";
        examples.lang = "de";
        byLevel(item.words).slice(0, 4).forEach((entry, i) => {
            if (i) examples.append(", ");
            examples.append(articleNode(gender), ` ${entry.word}`);
        });
        if (item.exceptions.length) {
            const except = document.createElement("span");
            except.className = "ddd-except";
            except.append("but ");
            byLevel(item.exceptions).slice(0, 3).forEach((entry, i) => {
                if (i) except.append(", ");
                except.append(articleNode(entry.genders[0]), ` ${entry.word}`);
            });
            examples.appendChild(except);
        }
        row.append(head, examples);
        return row;
    }


    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function latin(text) {
        return String(text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x20-\xff]/g, "");
    }

    async function exportPdf() {
        if (!game || !game.history.length) return;
        try {
            if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
        } catch (error) {
            ToolShared.showToast("The PDF library could not be loaded. Check your connection and try again.", "error");
            return;
        }
        const doc = new window.jspdf.jsPDF();
        const g = game;
        const accuracy = g.answers ? Math.round((g.right / g.answers) * 100) : 0;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text("Der Die Das", 20, 22);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(90);
        doc.text(latin(`${g.label} - ${new Date().toLocaleString("en-GB")}`), 20, 29);
        doc.text(`Score ${g.score}   Accuracy ${accuracy}%   Best streak ${g.bestStreak}   Words ${g.unique.size}`, 20, 35);
        let y = 48;
        const seen = new Map();
        g.history.forEach((item) => {
            const row = seen.get(item.entry.id) || {
                entry: item.entry,
                wrong: false,
                chosen: item.chosen
            };
            if (!item.correct) row.wrong = true;
            seen.set(item.entry.id, row);
        });
        const rows = Array.from(seen.values()).sort((a, b) => Number(b.wrong) - Number(a.wrong));
        rows.forEach((row) => {
            if (y > 275) {
                doc.addPage();
                y = 20;
            }
            const entry = row.entry;
            doc.setTextColor(row.wrong ? 180 : 20, row.wrong ? 50 : 110, row.wrong ? 50 : 70);
            doc.setFontSize(8);
            doc.text(row.wrong ? "MISSED" : "RIGHT", 20, y);
            doc.setTextColor(20);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(latin(phrase(entry)), 40, y);
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.setTextColor(80);
            doc.text(latin([pluralText(entry), entry.meaning].filter(Boolean).join(" - ")), 95, y);
            const rule = doc.splitTextToSize(latin(rules.explain(entry).text), 150);
            doc.setTextColor(120);
            doc.text(rule, 40, y + 5);
            y += 9 + rule.length * 4;
        });
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("adamdjellouli.com/tools/der_die_das", 20, 290);
        doc.save(`der-die-das-${new Date().toISOString().slice(0, 10)}.pdf`);
    }

    function exportProgress() {
        const blob = new Blob([JSON.stringify({
            v: 2,
            exported: new Date().toISOString(),
            settings: state.settings,
            progress: state.progress,
            best: state.best,
            totals: state.totals
        })], {
            type: "application/json"
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `der-die-das-progress-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    function importProgress(file) {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(String(reader.result));
                if (!data || data.v !== 2 || !data.progress || typeof data.progress.words !== "object") throw new Error("format");
                state.progress = Object.assign(Srs.blank(), data.progress);
                state.best = data.best || {};
                state.totals = Object.assign(state.totals, data.totals || {});
                persist();
                renderProgress();
                renderSummary();
                renderModeBests();
                ToolShared.showToast(`Imported progress for ${Object.keys(state.progress.words).length} words.`, "success");
            } catch (error) {
                ToolShared.showToast("That file is not a Der Die Das progress export.", "error");
            }
        };
        reader.readAsText(file);
    }

    function resetProgress() {
        if (!window.confirm("Forget every word you have practised, your best scores and your streak? This cannot be undone.")) return;
        state.progress = Srs.blank();
        state.best = {};
        state.totals = {
            games: 0,
            answers: 0,
            right: 0,
            bestStreak: 0
        };
        persist();
        renderProgress();
        renderSummary();
        renderModeBests();
    }


    function scrollToGame() {
        const nav = document.querySelector("nav");
        const offset = (nav ? nav.getBoundingClientRect().height : 0) + 12;
        const top = $("hud").getBoundingClientRect().top + window.scrollY - offset;
        if (Math.abs(window.scrollY - top) > 4) {
            window.scrollTo({
                top: Math.max(0, top),
                behavior: calm.matches ? "auto" : "smooth"
            });
        }
    }

    function isTyping(target) {
        return target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
    }

    function onKey(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        const key = event.key;
        if (!els.bonus.hidden) {
            if (key === "Escape") {
                event.preventDefault();
                closeBonus();
            }
            return;
        }
        if (isTyping(event.target)) return;
        const onButton = event.target && event.target.closest && event.target.closest("button, a, label, summary");

        if (!els.start.hidden) {
            if (key === "Enter" && !onButton && !els.startButton.disabled) {
                event.preventDefault();
                startGame();
            }
            return;
        }
        if (!els.over.hidden) {
            if (key === "Enter" && !onButton) {
                event.preventDefault();
                startGame(game && game.options);
            }
            return;
        }
        if (!game) return;
        if (game.status === "paused") {
            if (["Escape", "p", "P", " ", "Enter"].includes(key) && !(onButton && (key === " " || key === "Enter"))) {
                event.preventDefault();
                resumeGame();
            }
            return;
        }
        if (game.status === "frozen") {
            if ([" ", "Enter", "1", "2", "3", "ArrowDown"].includes(key)) {
                event.preventDefault();
                resumeAfterCorrection(performance.now());
                return;
            }
        }
        const lane = {
            "1": 0,
            "2": 1,
            "3": 2
        } [key];
        if (lane !== undefined) {
            event.preventDefault();
            steer(lane, true);
            return;
        }
        switch (key) {
            case "ArrowLeft":
                event.preventDefault();
                nudge(-1);
                break;
            case "ArrowRight":
                event.preventDefault();
                nudge(1);
                break;
            case "ArrowDown":
            case " ":
                event.preventDefault();
                dropWord();
                break;
            case "m":
            case "M":
                if (game.word) game.word.revealed = true;
                break;
            case "s":
            case "S":
                if (game.word) Speech.say(game.word.entry.word);
                break;
            case "Escape":
            case "p":
            case "P":
                event.preventDefault();
                pauseGame();
                break;
        }
    }

    let pointer = null;
    let lastTap = 0;

    function pointerPos(event) {
        const rect = els.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    function onPointerDown(event) {
        if (!game) return;
        if (game.status === "frozen") {
            resumeAfterCorrection(performance.now());
            return;
        }
        if (game.status !== "playing") return;
        const p = pointerPos(event);
        const L = layout();
        if (p.y >= L.binTop) {
            steer(laneAt(p.x), true);
            return;
        }
        const word = game.word;
        const now = performance.now();
        const onCard = word && Math.abs(p.x - clampX(word.x, word.w)) <= word.w / 2 && Math.abs(p.y - word.y) <= word.h / 2 + 6;
        pointer = {
            id: event.pointerId,
            x: p.x,
            y: p.y,
            t: now,
            onCard,
            offset: onCard ? p.x - word.x : 0,
            moved: false
        };
        if (now - lastTap < 300 && !onCard) dropWord();
        lastTap = now;
        els.canvas.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event) {
        if (!pointer || pointer.id !== event.pointerId || !game || !game.word || game.status !== "playing") return;
        const p = pointerPos(event);
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) pointer.moved = true;
        if (pointer.onCard && pointer.moved) {
            const word = game.word;
            word.dragging = true;
            word.x = clampX(p.x - pointer.offset, word.w);
            word.targetX = laneCenter(laneAt(p.x));
        }
        if (dy > 50 && dy > Math.abs(dx) * 1.5 && performance.now() - pointer.t < 400) dropWord();
    }

    function onPointerUp(event) {
        if (!pointer || pointer.id !== event.pointerId) return;
        const p = pointerPos(event);
        const word = game && game.word;
        if (word && game.status === "playing") {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            if (pointer.onCard && !pointer.moved) {
                word.revealed = true;
            } else if (word.dragging) {
                word.dragging = false;
            } else if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && performance.now() - pointer.t < 500) {
                nudge(dx > 0 ? 1 : -1);
            }
        }
        pointer = null;
    }


    function bind() {
        $("modeControl").addEventListener("change", (event) => {
            if (event.target.name !== "mode") return;
            state.settings.mode = event.target.value;
            persist();
        });
        $("optBonus").addEventListener("change", (event) => {
            state.settings.bonus = event.target.checked;
            persist();
        });
        $("optSpeak").addEventListener("change", (event) => {
            state.settings.speak = event.target.checked;
            persist();
        });
        $("optPatterns").addEventListener("change", (event) => {
            state.settings.patterns = event.target.checked;
            persist();
            draw(performance.now());
        });
        els.startButton.addEventListener("click", () => startGame());
        els.pauseButton.addEventListener("click", () => {
            if (game && game.status === "paused") resumeGame();
            else pauseGame();
        });
        els.soundButton.addEventListener("click", () => {
            state.settings.sound = !state.settings.sound;
            els.soundButton.setAttribute("aria-pressed", String(state.settings.sound));
            if (state.settings.sound) Sound.unlock();
            persist();
        });
        $("resumeButton").addEventListener("click", resumeGame);
        $("quitButton").addEventListener("click", () => endGame("quit"));
        $("againButton").addEventListener("click", () => startGame(game && game.options));
        $("mistakesButton").addEventListener("click", () => {
            if (!game) return;
            const words = Array.from(game.missed.values()).map((item) => item.entry);
            startGame({
                mode: "practice",
                words,
                source: "mistake",
                label: "Your mistakes"
            });
        });
        $("setupButton").addEventListener("click", () => {
            els.over.hidden = true;
            els.start.hidden = false;
            els.stage.classList.add("is-static");
            renderSummary();
            renderModeBests();
            els.startButton.focus({
                preventScroll: true
            });
        });
        $("replayMistakes").addEventListener("click", () => {
            const words = Srs.weakest(entries, state.progress, 20);
            if (!words.length) return;
            startGame({
                mode: "practice",
                words,
                source: "mistake",
                label: "Your mistakes"
            });
        });
        $("speakButton").addEventListener("click", () => Speech.say(lastSpoken));
        els.bonus.addEventListener("submit", submitBonus);
        $("bonusSkip").addEventListener("click", closeBonus);
        $("exportButton").addEventListener("click", exportProgress);
        $("importInput").addEventListener("change", (event) => {
            const file = event.target.files && event.target.files[0];
            if (file) importProgress(file);
            event.target.value = "";
        });
        $("resetButton").addEventListener("click", resetProgress);

        window.addEventListener("keydown", onKey);
        els.canvas.addEventListener("pointerdown", onPointerDown);
        els.canvas.addEventListener("pointermove", onPointerMove);
        els.canvas.addEventListener("pointerup", onPointerUp);
        els.canvas.addEventListener("pointercancel", onPointerUp);
        els.stage.tabIndex = -1;

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) pauseGame("Paused while you were away.");
        });
        window.addEventListener("blur", () => pauseGame("Paused while you were away."));
        const onResize = ToolShared.debounce(resize, 80);
        window.addEventListener("resize", onResize);
        if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(els.stage);
        ToolShared.onThemeChange(() => {
            readColors();
            draw(performance.now());
        });
        Speech.onChange((ready) => {
            speechReady = ready;
            $("optSpeakRow").hidden = !ready;
            if (!ready && state.settings.speak) state.settings.speak = false;
            if ($("lastAnswer").textContent) $("speakButton").hidden = !ready;
        });
        const kickLoop = () => {
            if (game && game.status !== "over") kick();
        };
        document.addEventListener("visibilitychange", kickLoop);
        window.setInterval(() => {
            if (game && (game.status === "playing" || game.status === "frozen") && !rafId) kick();
        }, 500);
    }

    async function init() {
        readColors();
        resize();
        bind();
        updateHud();
        try {
            const response = await fetch("words.json");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            parseWords(await response.json());
        } catch (error) {
            $("loadState").textContent = "The word list could not be loaded. Refresh the page to try again.";
            return;
        }
        $("loadState").hidden = true;
        els.startButton.disabled = false;
        renderSetup();
        renderProgress();
        renderRules();
        draw(performance.now());
    }

    window.DDDGame = {
        snapshot() {
            if (!game) return null;
            return {
                status: game.status,
                word: game.word ? game.word.entry.word : null,
                articles: game.word ? game.word.entry.articles : null,
                source: game.word ? game.word.source : null,
                score: game.score,
                lives: game.lives,
                clock: game.clock,
                streak: game.streak,
                level: game.level,
                answers: game.answers,
                right: game.right,
                bonus: game.status === "bonus" ? game.bonusEntry.plural : null
            };
        }
    };

    init();
})();