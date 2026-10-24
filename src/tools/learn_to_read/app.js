document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const content = window.PhonicsContent;
    const KEY = "phonicsAdventure.v3";
    const $ = (id) => document.getElementById(id);
    const app = $("phonics-app");
    const stage = $("stage");
    const play = $("play");
    const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const shuffle = (items) => {
        const copy = [...items];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    };
    const pick = (items) => items[Math.floor(Math.random() * items.length)];
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wordKey = (word) => word.toLocaleLowerCase().replace(/[^\p{L}]/gu, "");

    const strings = {
        en: {
            title: "Phonics Adventure", intro: "Learn letter sounds, build words and read little stories, one short level at a time.",
            soundOn: "Sound on", soundOff: "Sound off", welcome: "Hi, I’m Finn! Let’s learn to read together.",
            statStars: "stars", statStickers: "stickers", levelsDone: "of {total} levels done",
            playLevel: "Play level {n}", playAgain: "Play the big review again",
            mapTitle: "Your reading path", mapHint: "Finished levels can be played again for more stars.",
            stickerTitle: "Sticker book", stickerHint: "Every finished level adds a sticker.",
            grownups: "For grown-ups", howTitle: "How it works",
            howText: "Children learn a few letter sounds at a time in a fixed phonics order, then blend those sounds into real words and read short stories built from them. Each round mixes in earlier sounds, so practice keeps coming back.",
            howText2: "Every word, sound and instruction is a recorded clip, so it works the same on every device. Sit together for the first levels and say the sounds aloud with your child.",
            soundsTitle: "Sounds so far", masteryNote: "Green sounds are secure. Orange sounds need more practice and come back more often.",
            noSounds: "Sounds appear here after the first level.",
            settingsTitle: "Settings", slowVoice: "Slower voice", unlockAll: "Unlock every level",
            saved: "Progress is saved on this device. English and German each have their own path.",
            saveFail: "Progress could not be saved in this browser, but every level still works.",
            reset: "Reset this language’s progress", resetConfirm: "Reset all English progress? German progress is kept.",
            audioMissing: "Recorded audio could not load, so the device voice is used where possible.",
            kind_sounds: "New sounds", kind_words: "Words", kind_story: "Story", kind_review: "Review",
            locked: "Locked", stars: "{n} of 3 stars", levelName: "Level {n}: {name}", notPlayed: "Not played yet",
            close: "Back to the map", replay: "Hear it again", next: "Next", gotIt: "Got it!",
            readToMe: "Read to me", listen: "Listen", levelDone: "Level complete!", nextLevel: "Next level",
            backToMap: "Back to the map", playAgainLevel: "Play again", newSticker: "New sticker!",
            allDone: "You finished every level!", meet: "A new sound", progress: "Step {n} of {total}",
            tile: "Tile {letter}", slot: "Box {n}: {letter}. Tap to take it back.", emptySlot: "Empty box {n}",
            picture: "Picture: {word}", hearPicture: "Hear {word}", letterChoice: "Letter {letter}",
            correct: "Correct!", tryAgain: "Not quite, try again.", theEnd: "The end"
        },
        de: {
            title: "Lese-Abenteuer", intro: "Laute lernen, Wörter bauen und kleine Geschichten lesen, ein kurzes Level nach dem anderen.",
            soundOn: "Ton an", soundOff: "Ton aus", welcome: "Hallo, ich bin Finn! Komm, wir lernen zusammen lesen.",
            statStars: "Sterne", statStickers: "Sticker", levelsDone: "von {total} Levels geschafft",
            playLevel: "Level {n} spielen", playAgain: "Große Wiederholung noch einmal spielen",
            mapTitle: "Dein Lesepfad", mapHint: "Geschaffte Levels kannst du für mehr Sterne wiederholen.",
            stickerTitle: "Stickerheft", stickerHint: "Jedes geschaffte Level bringt einen Sticker.",
            grownups: "Für Erwachsene", howTitle: "So funktioniert es",
            howText: "Kinder lernen in fester Reihenfolge immer nur wenige Laute, verbinden sie dann zu echten Wörtern und lesen kurze Geschichten aus diesen Wörtern. Jede Runde mischt frühere Laute ein, damit sie immer wieder geübt werden.",
            howText2: "Alle Wörter, Laute und Anweisungen sind Aufnahmen und klingen auf jedem Gerät gleich. Spielt die ersten Levels gemeinsam und sprecht die Laute laut mit.",
            soundsTitle: "Bisherige Laute", masteryNote: "Grüne Laute sitzen. Orange Laute brauchen noch Übung und kommen öfter wieder.",
            noSounds: "Nach dem ersten Level erscheinen hier die Laute.",
            settingsTitle: "Einstellungen", slowVoice: "Langsamere Stimme", unlockAll: "Alle Levels freischalten",
            saved: "Der Fortschritt wird auf diesem Gerät gespeichert. Deutsch und Englisch haben je einen eigenen Pfad.",
            saveFail: "Der Fortschritt kann in diesem Browser nicht gespeichert werden, aber alle Levels funktionieren.",
            reset: "Fortschritt für Deutsch zurücksetzen", resetConfirm: "Den gesamten deutschen Fortschritt zurücksetzen? Der englische bleibt erhalten.",
            audioMissing: "Die Aufnahmen konnten nicht geladen werden, daher wird wenn möglich die Gerätestimme verwendet.",
            kind_sounds: "Neue Laute", kind_words: "Wörter", kind_story: "Geschichte", kind_review: "Wiederholung",
            locked: "Gesperrt", stars: "{n} von 3 Sternen", levelName: "Level {n}: {name}", notPlayed: "Noch nicht gespielt",
            close: "Zurück zur Karte", replay: "Noch einmal hören", next: "Weiter", gotIt: "Verstanden!",
            readToMe: "Vorlesen", listen: "Hören", levelDone: "Level geschafft!", nextLevel: "Nächstes Level",
            backToMap: "Zurück zur Karte", playAgainLevel: "Noch einmal", newSticker: "Neuer Sticker!",
            allDone: "Du hast alle Levels geschafft!", meet: "Ein neuer Laut", progress: "Schritt {n} von {total}",
            tile: "Baustein {letter}", slot: "Kästchen {n}: {letter}. Zum Zurücklegen tippen.", emptySlot: "Leeres Kästchen {n}",
            picture: "Bild: {word}", hearPicture: "{word} hören", letterChoice: "Laut {letter}",
            correct: "Richtig!", tryAgain: "Noch nicht ganz, versuch es nochmal.", theEnd: "Ende"
        }
    };
    const t = (key, vars = {}) => (strings[state.language][key] ?? strings.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");

    /* ---------- Content helpers ---------- */
    const L = () => content[state.language];
    const levels = () => L().levels;
    const phoneme = (grapheme) => L().phonemes[grapheme.toLocaleLowerCase()] ?? grapheme;
    const shown = (word) => L().spelling?.[word] ?? word;
    const pictureOf = (word) => L().pictures[word] ?? L().pictures[Object.keys(L().pictures).find((key) => wordKey(key) === wordKey(word))];
    const imageHtml = (pic, cls = "") => `<img class="pa-pic ${cls}" src="pics/${pic}.webp" alt="" draggable="false" width="240" height="240" />`;
    function tilesFor(word) {
        if (L().tiles?.[word]) return L().tiles[word];
        const teams = [...L().teams].sort((a, b) => b.length - a.length);
        const lower = word.toLocaleLowerCase();
        const out = [];
        for (let i = 0; i < word.length;) {
            const team = teams.find((item) => lower.startsWith(item, i));
            const size = team ? team.length : 1;
            out.push(word.slice(i, i + size));
            i += size;
        }
        return out;
    }
    const levelItems = (level) => (level.items ? level.items.split(" ") : []);
    // Sounds and picture words a child has met up to and including a level.
    function knownSounds(index) {
        return levels().slice(0, index + 1).filter((level) => level.kind === "sounds").flatMap(levelItems);
    }
    function knownWords(index) {
        const fromSounds = knownSounds(index).map((grapheme) => L().sounds[grapheme][0]);
        const fromWords = levels().slice(0, index + 1).filter((level) => level.kind === "words").flatMap(levelItems);
        return [...new Set([...fromSounds, ...fromWords])].filter((word) => pictureOf(word));
    }
    // Whether a word carries a sound where the question asks for it.
    function hasSound(word, grapheme, position) {
        const sounds = tilesFor(word).map(phoneme);
        const target = phoneme(grapheme);
        if (position === "start") return sounds[0] === target;
        if (position === "end") return sounds[sounds.length - 1] === target;
        return sounds.includes(target);
    }
    const anywhere = (word, grapheme) => tilesFor(word).map(phoneme).includes(phoneme(grapheme));

    /* ---------- Saved progress ---------- */
    const freshJourney = () => ({ done: {}, stats: {} });
    const freshState = () => ({ version: 3, language: "en", sound: true, slow: false, unlockAll: false, journeys: { en: freshJourney(), de: freshJourney() } });
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.floor(value))) : 0);
    let storageFailed = false;

    function cleanJourney(raw, lang) {
        const journey = freshJourney();
        if (!raw || typeof raw !== "object") return journey;
        const total = content[lang].levels.length;
        for (const [index, stars] of Object.entries(raw.done || {})) {
            if (Number(index) >= 0 && Number(index) < total && Number.isInteger(Number(index))) journey.done[index] = Math.max(1, Math.min(3, count(stars)));
        }
        for (const [key, value] of Object.entries(raw.stats || {})) {
            if (typeof key === "string" && key.length < 40 && value && typeof value === "object") journey.stats[key] = { c: count(value.c), w: count(value.w) };
        }
        return journey;
    }
    // Earlier versions tracked discovered letters and words; finished levels are rebuilt from them.
    function fromVersion2(raw, lang) {
        const journey = freshJourney();
        if (!raw || typeof raw !== "object") return journey;
        const sounds = new Set((raw.sounds || []).map(String));
        const words = new Set((raw.words || []).map((word) => wordKey(String(word))));
        const list = content[lang].levels;
        const satisfied = (level) => level.kind === "sounds" ? levelItems(level).every((item) => sounds.has(item))
            : level.kind === "words" ? levelItems(level).filter((word) => words.has(wordKey(word))).length >= 2 : null;
        for (let i = 0; i < list.length; i += 1) {
            let ok = satisfied(list[i]);
            if (ok === null) {
                const following = list.slice(i + 1).find((level) => level.kind !== "story" && level.kind !== "review");
                ok = Boolean(following && satisfied(following));
            }
            if (!ok) break;
            journey.done[i] = 1;
        }
        return journey;
    }
    function load() {
        const state = freshState();
        try {
            const saved = JSON.parse(localStorage.getItem(KEY));
            if (saved?.version === 3) {
                state.language = saved.language === "de" ? "de" : "en";
                state.sound = saved.sound !== false;
                state.slow = saved.slow === true;
                state.unlockAll = saved.unlockAll === true;
                for (const lang of ["en", "de"]) state.journeys[lang] = cleanJourney(saved.journeys?.[lang], lang);
                return state;
            }
            const old = JSON.parse(localStorage.getItem("phonicsAdventure.v2"));
            if (old?.version === 2) {
                state.language = old.language === "de" ? "de" : "en";
                state.sound = old.audio !== false;
                for (const lang of ["en", "de"]) state.journeys[lang] = fromVersion2(old.journeys?.[lang], lang);
            }
        } catch { /* Unreadable storage must never block play. */ }
        return state;
    }
    const state = load();
    const journey = () => state.journeys[state.language];
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); storageFailed = false; } catch { storageFailed = true; }
        $("save-note").textContent = t(storageFailed ? "saveFail" : "saved");
    }

    /* ---------- Sound ---------- */
    const speechReady = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
    const audioCache = new Map();
    let audioToken = 0;
    let currentAudio = null;
    let effects = null;
    let audioFailed = false;
    const clipEntry = (id) => window.PhonicsAudio?.[state.language]?.[id];
    function clipText(id) {
        const [kind, ...rest] = id.split(":");
        if (kind === "w") return rest.join(":");
        if (kind === "line") return L().lines[rest[0]];
        if (kind === "st") return L().stories[rest[0]]?.pages[Number(rest[1])]?.text;
        if (kind === "in") return L().sounds[rest[0]]?.[0];
        return null;
    }
    function element(id) {
        const entry = clipEntry(id);
        if (!entry) return null;
        const src = `audio/${state.language}/${entry[0]}`;
        if (!audioCache.has(src)) {
            const audio = new Audio();
            audio.preload = "auto";
            audio.src = src;
            audioCache.set(src, audio);
        }
        return audioCache.get(src);
    }
    const preload = (ids) => { if (state.sound) ids.forEach(element); };
    function stopAudio() {
        audioToken += 1;
        if (currentAudio) { currentAudio.pause(); currentAudio = null; }
        if (speechReady) window.speechSynthesis.cancel();
        document.querySelectorAll(".pa-reading").forEach((node) => node.classList.remove("pa-reading"));
        $("replay").classList.remove("pa-talking");
    }
    function speakFallback(id, token) {
        const text = clipText(id);
        if (!speechReady || !text) return Promise.resolve();
        return new Promise((resolve) => {
            const utterance = new window.SpeechSynthesisUtterance(text);
            utterance.lang = L().locale;
            utterance.rate = state.slow ? 0.75 : 0.9;
            const timer = setTimeout(resolve, 1500 + text.length * 120);
            utterance.onend = utterance.onerror = () => { clearTimeout(timer); resolve(); };
            if (token === audioToken) window.speechSynthesis.speak(utterance);
            else resolve();
        });
    }
    function playClip(id, token, onTime) {
        return new Promise((resolve) => {
            if (token !== audioToken || !state.sound) return resolve();
            const audio = element(id);
            if (!audio) { speakFallback(id, token).then(resolve); return; }
            const rate = state.slow ? 0.85 : 1;
            let frame = 0;
            const finish = () => {
                clearTimeout(timer);
                cancelAnimationFrame(frame);
                audio.onended = audio.onerror = null;
                resolve();
            };
            // Some browsers never fire "ended" for interrupted or blocked media.
            const timer = setTimeout(finish, (clipEntry(id)[1] / rate) * 1000 + 1500);
            audio.onended = finish;
            audio.onerror = () => {
                if (!audioFailed) { audioFailed = true; $("audio-note").textContent = t("audioMissing"); }
                finish();
            };
            try { audio.currentTime = 0; } catch { /* Not yet seekable. */ }
            audio.playbackRate = rate;
            currentAudio = audio;
            if (onTime) {
                const tick = () => { onTime(audio.currentTime); frame = requestAnimationFrame(tick); };
                frame = requestAnimationFrame(tick);
            }
            const started = audio.play();
            if (started) started.catch(() => speakFallback(id, token).then(finish));
        });
    }
    // Plays clips in order; resolves true when the whole sequence finished uninterrupted.
    async function say(ids, { onTime = null, gap = 140 } = {}) {
        stopAudio();
        const token = audioToken;
        const list = [].concat(ids).filter(Boolean);
        if (!state.sound) return true;
        $("replay").classList.add("pa-talking");
        for (const [index, id] of list.entries()) {
            await playClip(id, token, onTime && index === 0 ? onTime : null);
            if (token !== audioToken) return false;
            if (gap && index < list.length - 1) await sleep(gap);
        }
        if (token === audioToken) $("replay").classList.remove("pa-talking");
        return token === audioToken;
    }
    function tone(kind) {
        if (!state.sound) return;
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        try {
            effects ||= new Context();
            effects.resume().catch(() => {});
            const notes = { win: [523.25, 659.25, 783.99, 1046.5], soft: [311.13, 261.63], pop: [880], fanfare: [523.25, 659.25, 783.99, 659.25, 1046.5] }[kind];
            notes.forEach((frequency, index) => {
                const oscillator = effects.createOscillator();
                const gain = effects.createGain();
                const start = effects.currentTime + index * (kind === "fanfare" ? 0.13 : 0.08);
                oscillator.type = kind === "soft" ? "sine" : "triangle";
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(kind === "pop" ? 0.05 : 0.08, start + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, start + (kind === "soft" ? 0.22 : 0.3));
                oscillator.connect(gain).connect(effects.destination);
                oscillator.start(start);
                oscillator.stop(start + 0.35);
            });
        } catch { /* Visual feedback is enough when audio output is blocked. */ }
    }

    /* ---------- Map and sticker book ---------- */
    const unlocked = (index) => state.unlockAll || index === 0 || journey().done[index - 1] !== undefined || journey().done[index] !== undefined;
    const nextLevelIndex = () => {
        const index = levels().findIndex((_, i) => journey().done[i] === undefined);
        return index === -1 ? levels().length - 1 : index;
    };
    function levelName(level) {
        if (level.kind === "sounds") return levelItems(level).join(" ");
        if (level.kind === "story") return L().stories[level.story].title;
        return t(`kind_${level.kind}`);
    }
    function levelIcon(level) {
        if (level.kind === "sounds") return `<span class="pa-node-letters">${levelItems(level).map(escape).join(" ")}</span>`;
        if (level.kind === "words") return imageHtml(pictureOf(levelItems(level)[0]));
        if (level.kind === "story") return imageHtml(L().stories[level.story].cover);
        return imageHtml("trophy");
    }
    const starsHtml = (n, cls = "") => `<span class="pa-stars ${cls}" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "is-on" : ""}"></i>`).join("")}</span>`;
    const stickerOf = (index) => content.stickers[index % content.stickers.length];

    function renderMap() {
        const current = nextLevelIndex();
        $("level-map").innerHTML = `<svg class="pa-map-path" aria-hidden="true"></svg><ol class="pa-nodes">${levels().map((level, index) => {
            const stars = journey().done[index];
            const open = unlocked(index);
            const status = stars !== undefined ? "is-done" : index === current && open ? "is-current" : open ? "is-open" : "is-locked";
            const label = `${t("levelName", { n: index + 1, name: levelName(level) })}. ${!open ? t("locked") : stars !== undefined ? t("stars", { n: stars }) : t("notPlayed")}`;
            return `<li class="pa-node ${status} pa-kind-${level.kind}">
                <button type="button" data-level="${index}" ${open ? "" : "disabled"} aria-label="${escape(label)}">${open ? levelIcon(level) : imageHtml("lock", "pa-lock")}<span class="pa-node-number" aria-hidden="true">${index + 1}</span></button>
                ${index === current && open ? '<img class="pa-node-finn" src="assets/finn.webp" alt="" width="64" height="58" />' : ""}
                <span class="pa-node-label" aria-hidden="true">${escape(levelName(level))}</span>${starsHtml(stars || 0)}</li>`;
        }).join("")}</ol>`;
        $("level-map").querySelectorAll("[data-level]").forEach((button) => {
            button.onclick = () => startLevel(Number(button.dataset.level));
        });
        layoutMap();
        const done = Object.keys(journey().done).length;
        const stars = Object.values(journey().done).reduce((sum, n) => sum + n, 0);
        $("stat-level").textContent = done;
        $("stat-level-label").textContent = t("levelsDone", { total: levels().length });
        $("stat-stars").textContent = stars;
        $("stat-stickers").textContent = done;
        $("journey-fill").style.width = `${(done / levels().length) * 100}%`;
        $("play-next-label").textContent = done === levels().length ? t("playAgain") : t("playLevel", { n: current + 1 });
        $("sticker-book").innerHTML = levels().map((_, index) => {
            const won = journey().done[index] !== undefined;
            return `<span class="pa-sticker ${won ? "is-won" : ""}">${imageHtml(stickerOf(index))}</span>`;
        }).join("");
        renderMastery();
    }
    // Connects the level stones with a soft path drawn behind them.
    function drawPath() {
        const map = $("level-map");
        const svg = map.querySelector(".pa-map-path");
        if (!svg) return;
        const box = map.getBoundingClientRect();
        const points = [...map.querySelectorAll(".pa-node button")].map((button) => {
            const rect = button.getBoundingClientRect();
            return [rect.left - box.left + rect.width / 2, rect.top - box.top + rect.height / 2];
        });
        if (points.length < 2) return;
        const curve = (list) => list.map(([x, y], i) => {
            if (i === 0) return `M${x},${y}`;
            const [px, py] = list[i - 1];
            const mid = (py + y) / 2;
            return `C${px},${mid} ${x},${mid} ${x},${y}`;
        }).join(" ");
        const doneCount = levels().findIndex((_, i) => journey().done[i] === undefined);
        const reached = points.slice(0, (doneCount === -1 ? points.length : doneCount) + 1);
        svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
        svg.innerHTML = `<path class="pa-path-all" d="${curve(points)}"/>${reached.length > 1 ? `<path class="pa-path-done" d="${curve(reached)}"/>` : ""}`;
    }
    // Lays the stones out as a snake: left to right, then back, so the path winds across the page.
    function layoutMap() {
        const map = $("level-map");
        const nodes = [...map.querySelectorAll(".pa-node")];
        const columns = Math.max(1, Math.min(6, Math.floor(map.clientWidth / 150)));
        map.style.setProperty("--columns", columns);
        nodes.forEach((node, i) => {
            const row = Math.floor(i / columns);
            const column = row % 2 ? columns - 1 - (i % columns) : i % columns;
            node.style.gridRow = String(row + 1);
            node.style.gridColumn = String(column + 1);
            node.classList.toggle("is-low", columns > 1 && column % 2 === 1);
        });
        drawPath();
    }
    let mapWidth = 0;
    if (window.ResizeObserver) new ResizeObserver(() => {
        if ($("level-map").clientWidth !== mapWidth) { mapWidth = $("level-map").clientWidth; layoutMap(); }
    }).observe($("level-map"));
    function renderMastery() {
        const index = Math.max(-1, ...Object.keys(journey().done).map(Number));
        const learned = index >= 0 ? knownSounds(index) : [];
        $("mastery").innerHTML = learned.length ? learned.map((grapheme) => {
            const stat = journey().stats[grapheme] || { c: 0, w: 0 };
            const level = stat.c >= 2 && stat.w <= stat.c / 3 ? "is-secure" : stat.w > 0 ? "is-practise" : "";
            return `<span class="pa-mastery-item ${level}">${escape(grapheme)}</span>`;
        }).join("") : `<p class="pa-note">${t("noSounds")}</p>`;
    }

    /* ---------- Building a round ---------- */
    function weightedSample(items, weight, n) {
        const pool = items.map((item) => ({ item, w: Math.max(0.2, weight(item)) * (0.6 + Math.random()) }));
        return pool.sort((a, b) => b.w - a.w).slice(0, n).map(({ item }) => item);
    }
    const needsPractice = (key) => {
        const stat = journey().stats[key] || { c: 0, w: 0 };
        return 1 + stat.w * 2.5 - Math.min(stat.c, 6) * 0.3;
    };
    function letterTask(grapheme, index, type) {
        const [example, position] = L().sounds[grapheme];
        const words = knownWords(index);
        if (type === "pickLetter") {
            const candidates = words.filter((word) => hasSound(word, grapheme, position));
            const word = candidates.length ? pick(candidates) : example;
            const others = shuffle(knownSounds(index).filter((item) => phoneme(item) !== phoneme(grapheme) && !anywhere(word, item))).slice(0, 2);
            return { type, grapheme, word, position, options: shuffle([grapheme, ...others]), key: grapheme };
        }
        const targets = words.filter((word) => hasSound(word, grapheme, position));
        const word = targets.length ? pick(targets) : example;
        const used = new Set([pictureOf(word)]);
        const others = shuffle(words.filter((item) => !anywhere(item, grapheme) && !hasSound(item, grapheme, position))).filter((item) => {
            const pic = pictureOf(item);
            if (used.has(pic)) return false;
            used.add(pic);
            return true;
        }).slice(0, 2);
        return { type: "pickPicture", grapheme, word, position, options: shuffle([word, ...others]), key: grapheme };
    }
    function wordTask(word, index, type) {
        const tiles = tilesFor(word);
        if (type === "build") {
            const extra = index >= 7 && tiles.length <= 4
                ? shuffle(knownSounds(index).filter((item) => !tiles.some((tile) => tile.toLocaleLowerCase() === item) && item.length === 1)).slice(0, 1) : [];
            let bank = tiles.map((text, id) => ({ id, text })).concat(extra.map((text, i) => ({ id: tiles.length + i, text })));
            for (let tries = 0; tries < 6; tries += 1) {
                bank = shuffle(bank);
                if (bank.map((tile) => tile.text).join("") !== tiles.join("") || bank.length === 1) break;
            }
            return { type, word, tiles, bank, key: `w:${wordKey(word)}` };
        }
        const pool = knownWords(index).filter((item) => item !== word && pictureOf(item) !== pictureOf(word));
        // Similar-looking words make children read every letter instead of guessing from the first one.
        const similarity = (item) => {
            const a = tilesFor(item).map((tile) => tile.toLocaleLowerCase());
            return tiles.reduce((sum, tile, i) => sum + (a[i] === tile.toLocaleLowerCase() ? 2 : a.includes(tile.toLocaleLowerCase()) ? 0.5 : 0), 0) + Math.random();
        };
        const others = [];
        for (const item of [...pool].sort((a, b) => similarity(b) - similarity(a))) {
            if (others.length < 2 && !others.some((other) => pictureOf(other) === pictureOf(item))) others.push(item);
        }
        return { type: "read", word, tiles, options: shuffle([word, ...others]), key: `w:${wordKey(word)}` };
    }
    function buildRound(index) {
        const level = levels()[index];
        const items = levelItems(level);
        const tasks = [];
        if (level.kind === "sounds") {
            for (const grapheme of items) tasks.push({ type: "meet", grapheme }, letterTask(grapheme, index, "pickLetter"));
            const practice = shuffle(items.map((grapheme) => letterTask(grapheme, index, "pickPicture")));
            const earlier = knownSounds(index).filter((item) => !items.includes(item));
            const review = weightedSample(earlier, needsPractice, 2).map((grapheme) => letterTask(grapheme, index, pick(["pickLetter", "pickPicture"])));
            tasks.push(...shuffle([...practice, ...review]));
        } else if (level.kind === "words") {
            const chosen = weightedSample(items, (word) => needsPractice(`w:${wordKey(word)}`), Math.min(items.length, 5));
            const kinds = chosen.map((_, i) => (i % 2 ? "read" : "build"));
            const round = chosen.map((word, i) => wordTask(word, index, kinds[i]));
            if (chosen.length < 5) round.push(...chosen.map((word, i) => wordTask(word, index, kinds[i] === "read" ? "build" : "read")));
            round.push(letterTask(pick(knownSounds(index)), index, "pickPicture"));
            tasks.push(...shuffle(round));
        } else if (level.kind === "story") {
            L().stories[level.story].pages.forEach((_, page) => tasks.push({ type: "story", story: level.story, page }));
        } else {
            const sounds = weightedSample(knownSounds(index), needsPractice, 3);
            const words = weightedSample(knownWords(index).filter((word) => levels().slice(0, index).some((item) => item.kind === "words" && levelItems(item).includes(word))), (word) => needsPractice(`w:${wordKey(word)}`), 5);
            tasks.push(...shuffle([
                ...sounds.map((grapheme, i) => letterTask(grapheme, index, i % 2 ? "pickPicture" : "pickLetter")),
                ...words.map((word, i) => wordTask(word, index, i % 2 ? "build" : "read"))
            ]));
        }
        return tasks;
    }

    /* ---------- Playing a round ---------- */
    let round = null;
    function setGuide(text) { $("play-title").textContent = text; }
    function announce(text) { $("announcer").textContent = ""; requestAnimationFrame(() => { $("announcer").textContent = text; }); }
    function setInert(on) {
        document.querySelectorAll("body > nav, body > footer, body > .skip-link, .pa > .breadcrumbs, #phonics-app > :not(#play)").forEach((node) => {
            node.inert = on;
        });
    }
    function startLevel(index) {
        if (!unlocked(index)) return;
        round = { index, tasks: buildRound(index), step: 0, mistakes: 0, taskMistakes: 0, busy: false, replay: null };
        play.hidden = false;
        document.body.classList.add("pa-playing");
        setInert(true);
        $("play-level").textContent = `${index + 1}`;
        $("close-play").setAttribute("aria-label", t("close"));
        $("replay").setAttribute("aria-label", t("replay"));
        $("replay").focus({ preventScroll: true });
        const intro = { sounds: "line:sounds", words: "line:words", story: "line:storyStart", review: "line:review" }[levels()[index].kind];
        showTask(intro);
    }
    function closePlay() {
        stopAudio();
        round = null;
        play.hidden = true;
        document.body.classList.remove("pa-playing");
        setInert(false);
        renderMap();
        const current = $("level-map").querySelector(".is-current button") || $("play-next");
        current.focus({ preventScroll: true });
    }
    function updateProgress() {
        const total = round.tasks.length;
        $("play-progress-fill").style.width = `${(round.step / total) * 100}%`;
        $("play-progress").setAttribute("aria-valuemax", String(total));
        $("play-progress").setAttribute("aria-valuenow", String(round.step));
        $("play-progress").setAttribute("aria-label", t("progress", { n: Math.min(round.step + 1, total), total }));
    }
    function showTask(lead = null) {
        if (!round) return;
        updateProgress();
        round.busy = false;
        round.taskMistakes = 0;
        if (round.step >= round.tasks.length) return finishRound();
        const task = round.tasks[round.step];
        stage.className = `pa-stage pa-task-${task.type}`;
        ({ meet: renderMeet, pickLetter: renderPickLetter, pickPicture: renderPickPicture, build: renderBuild, read: renderRead, story: renderStory })[task.type](task, lead);
        const next = round.tasks[round.step + 1];
        if (next) preload(clipsFor(next));
    }
    function clipsFor(task) {
        if (task.type === "meet") return [`in:${task.grapheme}`, `ph:${task.grapheme}`];
        if (task.type === "story") return [`st:${task.story}:${task.page}`];
        return [task.word && `w:${wordKey(task.word)}`, ...(task.tiles || []).map((tile) => `ph:${tile.toLocaleLowerCase()}`)];
    }
    const questionLine = (task) => task.type === "pickLetter"
        ? { start: "line:startQ", end: "line:endQ", in: "line:inQ" }[task.position]
        : { start: "line:findStart", end: "line:findEnd", in: "line:findIn" }[task.position];
    // Records the first try of each task for the mastery chart and spaced review.
    function record(task, correct) {
        if (!task.key) return;
        const stat = journey().stats[task.key] ||= { c: 0, w: 0 };
        if (correct && round.taskMistakes === 0) stat.c += 1;
        if (!correct && round.taskMistakes === 1) stat.w += 1;
    }
    async function success(task, button, clips = []) {
        round.busy = true;
        record(task, true);
        button?.classList.add("is-right");
        stage.classList.add("pa-solved");
        tone("win");
        burst(button || stage);
        announce(t("correct"));
        await say([...clips, `line:praise${1 + Math.floor(Math.random() * 8)}`]);
        if (!round || round.tasks[round.step] !== task) return;
        await sleep(state.sound ? 250 : 650);
        if (!round || round.tasks[round.step] !== task) return;
        round.step += 1;
        showTask();
    }
    async function mistake(task, button, clips = []) {
        round.taskMistakes += 1;
        if (task.type !== "story") round.mistakes += 1;
        record(task, false);
        tone("soft");
        announce(t("tryAgain"));
        if (button) {
            button.classList.remove("is-wrong");
            void button.offsetWidth;
            button.classList.add("is-wrong");
        }
        const done = await say([...clips, `line:retry${1 + Math.floor(Math.random() * 4)}`]);
        if (round?.taskMistakes >= 2) {
            stage.querySelector("[data-answer='true']")?.classList.add("is-hint");
            if (done) say("line:hereItIs");
        } else if (done && round?.replay) round.replay();
    }
    function burst(anchor) {
        if (reducedMotion()) return;
        const rect = anchor.getBoundingClientRect();
        const layer = document.createElement("div");
        layer.className = "pa-burst";
        layer.style.left = `${rect.left + rect.width / 2}px`;
        layer.style.top = `${rect.top + rect.height / 2}px`;
        layer.innerHTML = Array.from({ length: 14 }, (_, i) => `<i style="--a:${(i / 14) * 360}deg;--d:${60 + Math.random() * 50}px;--c:${i % 4}"></i>`).join("");
        document.body.append(layer);
        setTimeout(() => layer.remove(), 900);
    }
    const speakerButton = (id, label) => `<button type="button" class="pa-speaker" id="${id}" aria-label="${escape(label)}"><span aria-hidden="true"></span></button>`;
    const graphemeShown = (grapheme) => (state.language === "de" && grapheme.length === 1 ? `${grapheme.toUpperCase()} ${grapheme}` : grapheme);

    function renderMeet(task, lead) {
        const [example] = L().sounds[task.grapheme];
        setGuide(t("meet"));
        stage.innerHTML = `<div class="pa-meet">
            <button type="button" class="pa-big-letter" id="meet-letter" aria-label="${escape(t("listen"))}: ${escape(task.grapheme)}">${escape(graphemeShown(task.grapheme))}</button>
            <button type="button" class="pa-card pa-card-large" id="meet-picture" aria-label="${escape(t("hearPicture", { word: shown(example) }))}">${imageHtml(pictureOf(example))}<span class="pa-card-word">${highlight(example, task.grapheme)}</span></button>
        </div><div class="pa-actions"><button type="button" class="pa-next" id="meet-next">${t("gotIt")}</button></div>`;
        round.replay = () => say(`in:${task.grapheme}`);
        $("meet-letter").onclick = () => { pulse($("meet-letter")); say(`ph:${task.grapheme}`); };
        $("meet-picture").onclick = () => say(`w:${wordKey(example)}`);
        $("meet-next").onclick = () => { if (round.busy) return; round.busy = true; tone("pop"); round.step += 1; showTask(); };
        say([lead, `in:${task.grapheme}`]);
    }
    // Marks where the sound sits in the example word.
    function highlight(word, grapheme) {
        const tiles = tilesFor(word);
        let marked = false;
        const position = L().sounds[grapheme]?.[1];
        return tiles.map((tile, i) => {
            const hit = !marked && tile.toLocaleLowerCase() === grapheme && (position !== "start" || i === 0) && (position !== "end" || i === tiles.length - 1);
            if (hit) marked = true;
            return hit ? `<b>${escape(tile)}</b>` : escape(tile);
        }).join("");
    }
    function pulse(node) {
        node.classList.remove("pa-pulse");
        void node.offsetWidth;
        node.classList.add("pa-pulse");
    }
    function renderPickLetter(task, lead) {
        setGuide(L().lines[questionLine(task).slice(5)]);
        stage.innerHTML = `<div class="pa-prompt-picture"><button type="button" class="pa-card pa-card-large" id="prompt-picture" aria-label="${escape(t("hearPicture", { word: shown(task.word) }))}">${imageHtml(pictureOf(task.word))}<span class="pa-card-badge" aria-hidden="true"></span></button></div>
            <div class="pa-choices pa-letter-options">${task.options.map((option) => `<button type="button" class="pa-letter-option" data-option="${escape(option)}" data-answer="${option === task.grapheme}" aria-label="${escape(t("letterChoice", { letter: option }))}">${escape(option)}</button>`).join("")}</div>`;
        round.replay = () => say([`w:${wordKey(task.word)}`, questionLine(task)]);
        $("prompt-picture").onclick = () => say(`w:${wordKey(task.word)}`);
        stage.querySelectorAll("[data-option]").forEach((button) => {
            button.onclick = () => {
                if (round.busy || button.disabled) return;
                if (button.dataset.option === task.grapheme) {
                    stage.querySelectorAll("[data-option]").forEach((item) => { item.disabled = true; });
                    success(task, button, [`ph:${task.grapheme}`, `w:${wordKey(task.word)}`]);
                } else {
                    button.disabled = true;
                    mistake(task, button, [`ph:${button.dataset.option}`]);
                }
            };
        });
        say([lead, `w:${wordKey(task.word)}`, questionLine(task)]);
    }
    function renderPickPicture(task, lead) {
        setGuide(L().lines[questionLine(task).slice(5)]);
        stage.innerHTML = `<div class="pa-prompt-sound"><button type="button" class="pa-big-letter pa-big-letter-small" id="prompt-sound" aria-label="${escape(t("listen"))}: ${escape(task.grapheme)}">${escape(graphemeShown(task.grapheme))}</button></div>
            <div class="pa-choices pa-picture-options">${task.options.map((option) => `<button type="button" class="pa-card" data-option="${escape(option)}" data-answer="${option === task.word}" aria-label="${escape(t("picture", { word: shown(option) }))}">${imageHtml(pictureOf(option))}</button>`).join("")}</div>`;
        round.replay = () => say([questionLine(task), `ph:${task.grapheme}`]);
        $("prompt-sound").onclick = () => { pulse($("prompt-sound")); say(`ph:${task.grapheme}`); };
        stage.querySelectorAll("[data-option]").forEach((button) => {
            button.onclick = () => {
                if (round.busy || button.disabled) return;
                if (button.dataset.option === task.word) {
                    stage.querySelectorAll("[data-option]").forEach((item) => { item.disabled = true; });
                    button.insertAdjacentHTML("beforeend", `<span class="pa-card-word">${highlight(task.word, task.grapheme)}</span>`);
                    success(task, button, [`w:${wordKey(task.word)}`]);
                } else {
                    button.disabled = true;
                    button.insertAdjacentHTML("beforeend", `<span class="pa-card-word">${escape(shown(button.dataset.option))}</span>`);
                    mistake(task, button, [`w:${wordKey(button.dataset.option)}`]);
                }
            };
        });
        say([lead, questionLine(task), `ph:${task.grapheme}`]);
    }
    function renderBuild(task, lead) {
        const slots = Array(task.tiles.length).fill(null);
        setGuide(L().lines.build);
        stage.innerHTML = `<div class="pa-prompt-picture"><button type="button" class="pa-card pa-card-large" id="prompt-picture" aria-label="${escape(t("hearPicture", { word: shown(task.word) }))}">${imageHtml(pictureOf(task.word))}<span class="pa-card-badge" aria-hidden="true"></span></button></div>
            <div class="pa-slots" id="slots" data-target="${escape(task.tiles.join("|"))}"></div>
            <div class="pa-bank" id="bank">${task.bank.map((tile) => `<button type="button" class="pa-tile" data-tile="${tile.id}" aria-label="${escape(t("tile", { letter: tile.text }))}">${escape(tile.text)}</button>`).join("")}</div>`;
        round.replay = () => say([`line:build`, `w:${wordKey(task.word)}`]);
        $("prompt-picture").onclick = () => say(`w:${wordKey(task.word)}`);
        const textOf = (id) => task.bank.find((tile) => tile.id === id).text;
        const sync = () => {
            $("slots").innerHTML = slots.map((id, i) => `<button type="button" class="pa-slot ${id === null ? "" : "is-filled"}" data-slot="${i}" ${id === null ? "disabled" : ""} aria-label="${escape(id === null ? t("emptySlot", { n: i + 1 }) : t("slot", { n: i + 1, letter: textOf(id) }))}">${id === null ? "" : escape(textOf(id))}</button>`).join("");
            $("slots").querySelectorAll("[data-slot]").forEach((button) => {
                button.onclick = () => {
                    if (round.busy) return;
                    slots[Number(button.dataset.slot)] = null;
                    sync();
                };
            });
            stage.querySelectorAll("[data-tile]").forEach((button) => {
                button.disabled = slots.includes(Number(button.dataset.tile));
                button.classList.remove("is-hint");
            });
            // After two misses the next correct tile glows.
            if (round.taskMistakes >= 2) {
                const gap = slots.findIndex((id, i) => id === null || textOf(id) !== task.tiles[i]);
                const wanted = task.bank.find((tile) => tile.text === task.tiles[gap] && !slots.includes(tile.id));
                if (wanted) stage.querySelector(`[data-tile="${wanted.id}"]`).classList.add("is-hint");
            }
        };
        const add = (id) => {
            if (round.busy || slots.includes(id)) return;
            const free = slots.indexOf(null);
            if (free < 0) return;
            slots[free] = id;
            sync();
            say(`ph:${textOf(id).toLocaleLowerCase()}`);
            if (!slots.includes(null)) check();
        };
        const check = async () => {
            const built = slots.map(textOf);
            if (built.join("") === task.tiles.join("")) {
                $("slots").querySelectorAll(".pa-slot").forEach((slot) => slot.classList.add("is-right"));
                // Model blending: each sound, then the whole word.
                await sleep(state.sound ? 450 : 0);
                success(task, $("slots"), [...task.tiles.map((tile) => `ph:${tile.toLocaleLowerCase()}`), `w:${wordKey(task.word)}`]);
            } else {
                round.busy = true;
                $("slots").querySelectorAll(".pa-slot").forEach((slot, i) => slot.classList.toggle("is-wrong", built[i] !== task.tiles[i]));
                await sleep(800);
                if (!round || round.tasks[round.step] !== task) return;
                built.forEach((text, i) => { if (text !== task.tiles[i]) slots[i] = null; });
                round.busy = false;
                mistake(task, null, []);
                sync();
            }
        };
        stage.querySelectorAll("[data-tile]").forEach((button) => { button.onclick = () => add(Number(button.dataset.tile)); });
        round.keyboard = (key) => {
            const free = task.bank.filter((tile) => !slots.includes(tile.id));
            const match = free.find((tile) => tile.text.toLocaleLowerCase() === key) || free.find((tile) => tile.text.toLocaleLowerCase().startsWith(key));
            if (key === "backspace") {
                const last = slots.findLastIndex((id) => id !== null);
                if (last >= 0 && !round.busy) { slots[last] = null; sync(); }
            } else if (match) add(match.id);
        };
        sync();
        say([lead, "line:build", `w:${wordKey(task.word)}`]);
    }
    function renderRead(task, lead) {
        setGuide(L().lines.read);
        stage.innerHTML = `<div class="pa-read-word" id="read-word">${task.tiles.map((tile) => `<button type="button" class="pa-read-tile" data-sound="${escape(tile.toLocaleLowerCase())}" aria-label="${escape(t("listen"))}: ${escape(tile)}">${escape(tile)}</button>`).join("")}</div>
            <div class="pa-choices pa-picture-options">${task.options.map((option) => `<button type="button" class="pa-card" data-option="${escape(option)}" data-answer="${option === task.word}" aria-label="${escape(t("picture", { word: shown(option) }))}">${imageHtml(pictureOf(option))}</button>`).join("")}</div>`;
        round.replay = () => say("line:read");
        stage.querySelectorAll("[data-sound]").forEach((button) => {
            button.onclick = () => { pulse(button); say(`ph:${button.dataset.sound}`); };
        });
        stage.querySelectorAll("[data-option]").forEach((button) => {
            button.onclick = () => {
                if (round.busy || button.disabled) return;
                if (button.dataset.option === task.word) {
                    stage.querySelectorAll("[data-option]").forEach((item) => { item.disabled = true; });
                    success(task, button, [`w:${wordKey(task.word)}`]);
                } else {
                    button.disabled = true;
                    button.insertAdjacentHTML("beforeend", `<span class="pa-card-word">${escape(shown(button.dataset.option))}</span>`);
                    // After a miss, model sounding out the word before the next try.
                    mistake(task, button, [`w:${wordKey(button.dataset.option)}`]).then(() => {
                        if (round?.tasks[round.step] === task && round.taskMistakes === 1) say(task.tiles.map((tile) => `ph:${tile.toLocaleLowerCase()}`), { gap: 220 });
                    });
                }
            };
        });
        say([lead, "line:read"]);
    }
    function renderStory(task, lead) {
        const story = L().stories[task.story];
        const page = story.pages[task.page];
        const id = `st:${task.story}:${task.page}`;
        const words = page.text.split(/\s+/);
        setGuide(`${story.title} · ${task.page + 1}/${story.pages.length}`);
        stage.innerHTML = `<div class="pa-story-pictures">${page.pics.map((pic) => `<span class="pa-card pa-card-static">${imageHtml(pic)}</span>`).join("")}</div>
            <p class="pa-sentence" id="sentence">${words.map((word, i) => `<button type="button" class="pa-word" data-index="${i}" data-word="${escape(wordKey(word))}" data-answer="${wordKey(word) === wordKey(page.target)}">${escape(word)}</button>`).join(" ")}</p>
            <div class="pa-story-tools"><button type="button" class="pa-read-aloud" id="read-aloud"><span aria-hidden="true"></span>${t("readToMe")}</button><span class="pa-find" id="find-hint" hidden></span></div>`;
        const buttons = [...stage.querySelectorAll(".pa-word")];
        const timings = clipEntry(id)?.[2];
        const follow = (time) => {
            if (!timings) return;
            const current = timings.findLastIndex((start) => time >= start - 0.05);
            buttons.forEach((button, i) => button.classList.toggle("pa-reading", i === current));
        };
        const readAloud = async () => {
            const finished = await say(id, { onTime: follow });
            buttons.forEach((button) => button.classList.remove("pa-reading"));
            return finished;
        };
        const ask = () => say(["line:storyFind", `w:${wordKey(page.target)}`]);
        round.replay = ask;
        $("read-aloud").onclick = () => readAloud();
        buttons.forEach((button) => {
            button.onclick = async () => {
                if (round.busy) return;
                if (button.dataset.answer === "true") {
                    buttons.forEach((item) => { item.disabled = true; });
                    const last = task.page === story.pages.length - 1;
                    success(task, button, [`w:${button.dataset.word}`, ...(last ? ["line:theEnd"] : [])]);
                } else {
                    pulse(button);
                    round.taskMistakes += 1;
                    // Exploring words is welcome: it plays the word and only shows the target after two misses.
                    if (await say(`w:${button.dataset.word}`) && round?.tasks[round.step] === task) {
                        if (round.taskMistakes >= 2) {
                            $("find-hint").hidden = false;
                            $("find-hint").textContent = page.target;
                        }
                        ask();
                    }
                }
            };
        });
        (async () => {
            if (lead && !(await say(lead))) return;
            if (await readAloud()) ask();
        })();
        if (!state.sound) {
            $("find-hint").hidden = false;
            $("find-hint").textContent = page.target;
        }
    }
    function finishRound() {
        const index = round.index;
        const level = levels()[index];
        const stars = level.kind === "story" ? 3 : round.mistakes <= 1 ? 3 : round.mistakes <= 3 ? 2 : 1;
        const first = journey().done[index] === undefined;
        journey().done[index] = Math.max(journey().done[index] || 0, stars);
        save();
        const all = levels().every((_, i) => journey().done[i] !== undefined);
        updateProgress();
        setGuide(t("levelDone"));
        stage.className = "pa-stage pa-task-reward";
        stage.innerHTML = `<div class="pa-reward">
            <h2>${all && first ? t("allDone") : t("levelDone")}</h2>
            ${starsHtml(stars, "pa-stars-big")}
            ${first ? `<div class="pa-reward-sticker"><span class="pa-sticker is-won is-new">${imageHtml(stickerOf(index))}</span><p>${t("newSticker")}</p></div>` : ""}
            <div class="pa-actions">
                ${index < levels().length - 1 ? `<button type="button" class="pa-next" id="reward-next">${t("nextLevel")}</button>` : ""}
                <button type="button" class="pa-secondary" id="reward-again">${t("playAgainLevel")}</button>
                <button type="button" class="pa-secondary" id="reward-map">${t("backToMap")}</button>
            </div></div>`;
        tone("fanfare");
        if (!reducedMotion()) stage.querySelectorAll(".pa-stars-big i.is-on").forEach((star, i) => { star.style.animationDelay = `${0.25 + i * 0.3}s`; });
        burst(stage.querySelector(".pa-reward h2"));
        round.replay = null;
        $("reward-next")?.addEventListener("click", () => startLevel(index + 1));
        $("reward-again").onclick = () => startLevel(index);
        $("reward-map").onclick = closePlay;
        ($("reward-next") || $("reward-map")).focus({ preventScroll: true });
        say([all && first ? "line:allDone" : "line:levelDone", first ? "line:sticker" : null]);
    }

    /* ---------- Page wiring ---------- */
    function translate() {
        app.lang = state.language;
        document.documentElement.lang = state.language === "de" ? "de" : "en";
        app.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
        app.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === state.language)));
        $("sound-toggle").setAttribute("aria-pressed", String(state.sound));
        $("sound-label").textContent = t(state.sound ? "soundOn" : "soundOff");
        $("slow-voice").checked = state.slow;
        $("unlock-all").checked = state.unlockAll;
        $("save-note").textContent = t(storageFailed ? "saveFail" : "saved");
        renderMap();
    }
    $("sound-toggle").onclick = () => {
        state.sound = !state.sound;
        if (!state.sound) stopAudio();
        save();
        translate();
    };
    app.querySelectorAll("[data-language]").forEach((button) => {
        button.onclick = () => {
            if (state.language === button.dataset.language) return;
            stopAudio();
            state.language = button.dataset.language;
            save();
            translate();
        };
    });
    $("play-next").onclick = () => startLevel(nextLevelIndex());
    $("close-play").onclick = closePlay;
    $("replay").onclick = () => { if (round?.replay) round.replay(); };
    $("slow-voice").onchange = (event) => { state.slow = event.target.checked; save(); };
    $("unlock-all").onchange = (event) => { state.unlockAll = event.target.checked; save(); renderMap(); };
    $("reset-progress").onclick = () => {
        if (!window.confirm(t("resetConfirm"))) return;
        state.journeys[state.language] = freshJourney();
        save();
        renderMap();
    };
    document.addEventListener("keydown", (event) => {
        if (!round) return;
        if (event.key === "Escape") { event.preventDefault(); closePlay(); return; }
        const task = round.tasks[round.step];
        if (task?.type !== "build" || event.ctrlKey || event.metaKey || event.altKey || !round.keyboard) return;
        if (event.key === "Backspace") { event.preventDefault(); round.keyboard("backspace"); }
        else if (event.key.length === 1 && /\p{L}/u.test(event.key)) { event.preventDefault(); round.keyboard(event.key.toLocaleLowerCase()); }
    });
    // Keep focus inside the round while it is open.
    play.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = [...play.querySelectorAll("button:not(:disabled)")].filter((node) => node.offsetParent !== null);
        if (!items.length) return;
        const [first, last] = [items[0], items[items.length - 1]];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopAudio(); });
    if (!window.PhonicsAudio) $("audio-note").textContent = t("audioMissing");
    translate();
    save();
});
