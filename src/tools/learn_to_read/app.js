document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const content = window.PhonicsContent;
    const KEY = "phonicsAdventure.v4";
    const PATHS = content.paths;
    const $ = (id) => document.getElementById(id);
    const app = $("phonics-app");
    const stage = $("stage");
    const play = $("play");
    const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    } [char]));
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
            title: "Phonics Adventure",
            intro: "Three paths to reading: letters, words, and sentences with little stories. One short level at a time.",
            soundOn: "Sound on",
            soundOff: "Sound off",
            welcome: "Hi, I’m Finn! Let’s learn to read together.",
            statStars: "stars",
            statStickers: "stickers",
            levelsDone: "of {total} levels done",
            playLevel: "Play level {n}",
            playAgain: "Play the last review again",
            choosePath: "Choose a path",
            path_letters: "Letters",
            path_words: "Words",
            path_stories: "Stories",
            pathHint_letters: "Meet letters, find them, then match big and small.",
            pathHint_words: "Build and read words in four different ways.",
            pathHint_stories: "Read sentences, fill gaps and enjoy short stories.",
            mapTitle: "Your path",
            mapHint: "Finished levels can be played again for more stars.",
            stickerTitle: "Sticker book",
            stickerHint: "Every finished level adds a sticker.",
            closeStickers: "Close the sticker book",
            grownups: "For grown-ups",
            howTitle: "How it works",
            howText: "The three paths can be played in any order. Letters starts with capitals; small letters come once the capitals are known. Words builds whole words from ready letters, fills in missing letters and matches words with pictures. Stories moves from single sentences to short stories with questions.",
            howText2: "Every word, letter name and instruction is a recorded clip, so it works the same on every device. Each round mixes in things learned earlier, and mistakes bring them back more often.",
            soundsTitle: "Letters so far",
            masteryNote: "Green letters are secure. Orange letters need more practice and come back more often.",
            noSounds: "Letters appear here after the first letters level.",
            settingsTitle: "Settings",
            slowVoice: "Slower voice",
            unlockAll: "Unlock every level",
            autoFullscreen: "Full screen while playing (keeps ads away)",
            fullscreen: "Full screen",
            exitFullscreen: "Leave full screen",
            saved: "Progress is saved on this device. Every language has its own paths.",
            saveFail: "Progress could not be saved in this browser, but every level still works.",
            reset: "Reset this language’s progress",
            resetConfirm: "Reset all English progress? German progress is kept.",
            audioMissing: "Recorded audio could not load, so the device voice is used where possible.",
            kind_letters: "Letters",
            kind_words: "Words",
            kind_story: "Story",
            kind_review: "Review",
            kind_small: "Small letters",
            mode_picture: "Sentences",
            mode_cloze: "Missing word",
            mode_order: "Word order",
            mode_mix: "Mixed sentences",
            locked: "Locked",
            stars: "{n} of 3 stars",
            levelName: "Level {n}: {name}",
            notPlayed: "Not played yet",
            close: "Back to the map",
            replay: "Hear it again",
            readToMe: "Read to me",
            nextPage: "Next page",
            storyQuestions: "Answer the questions",
            listen: "Listen",
            levelDone: "Level complete!",
            nextLevel: "Next level",
            backToMap: "Back to the map",
            playAgainLevel: "Play again",
            newSticker: "New sticker!",
            allDone: "You finished the whole path!",
            meet: "A new letter",
            progress: "Step {n} of {total}",
            tile: "Tile {letter}",
            slot: "Box {n}: {letter}. Tap to take it back.",
            emptySlot: "Empty box {n}",
            picture: "Picture: {word}",
            hearPicture: "Hear {word}",
            letterChoice: "Letter {letter}",
            wordChoice: "Word {word}",
            correct: "Correct!",
            tryAgain: "Not quite, try again.",
            gap: "missing word"
        },
        de: {
            title: "Lese-Abenteuer",
            intro: "Drei Wege zum Lesen: Buchstaben, Wörter und Sätze mit kleinen Geschichten. Ein kurzes Level nach dem anderen.",
            soundOn: "Ton an",
            soundOff: "Ton aus",
            welcome: "Hallo, ich bin Finn! Komm, wir lernen zusammen lesen.",
            statStars: "Sterne",
            statStickers: "Sticker",
            levelsDone: "von {total} Levels geschafft",
            playLevel: "Level {n} spielen",
            playAgain: "Letzte Wiederholung noch einmal spielen",
            choosePath: "Wähle einen Pfad",
            path_letters: "Buchstaben",
            path_words: "Wörter",
            path_stories: "Geschichten",
            pathHint_letters: "Buchstaben kennenlernen, finden und groß mit klein verbinden.",
            pathHint_words: "Wörter auf vier verschiedene Arten bauen und lesen.",
            pathHint_stories: "Sätze lesen, Lücken füllen und kurze Geschichten genießen.",
            mapTitle: "Dein Pfad",
            mapHint: "Geschaffte Levels kannst du für mehr Sterne wiederholen.",
            stickerTitle: "Stickerheft",
            stickerHint: "Jedes geschaffte Level bringt einen Sticker.",
            closeStickers: "Stickerheft schließen",
            grownups: "Für Erwachsene",
            howTitle: "So funktioniert es",
            howText: "Die drei Pfade können in beliebiger Reihenfolge gespielt werden. Buchstaben beginnt mit Großbuchstaben; die kleinen kommen, sobald die großen sitzen. Wörter baut ganze Wörter aus fertigen Buchstaben, ergänzt fehlende Buchstaben und verbindet Wörter mit Bildern. Geschichten führt von einzelnen Sätzen zu kurzen Geschichten mit Fragen.",
            howText2: "Alle Wörter, Buchstabennamen und Anweisungen sind Aufnahmen und klingen auf jedem Gerät gleich. Jede Runde mischt früher Gelerntes ein, und Fehler holen es öfter zurück.",
            soundsTitle: "Bisherige Buchstaben",
            masteryNote: "Grüne Buchstaben sitzen. Orange Buchstaben brauchen noch Übung und kommen öfter wieder.",
            noSounds: "Nach dem ersten Buchstaben-Level erscheinen hier die Buchstaben.",
            settingsTitle: "Einstellungen",
            slowVoice: "Langsamere Stimme",
            unlockAll: "Alle Levels freischalten",
            autoFullscreen: "Vollbild beim Spielen (hält Werbung fern)",
            fullscreen: "Vollbild",
            exitFullscreen: "Vollbild verlassen",
            saved: "Der Fortschritt wird auf diesem Gerät gespeichert. Jede Sprache hat eigene Pfade.",
            saveFail: "Der Fortschritt kann in diesem Browser nicht gespeichert werden, aber alle Levels funktionieren.",
            reset: "Fortschritt für Deutsch zurücksetzen",
            resetConfirm: "Den gesamten deutschen Fortschritt zurücksetzen? Der englische bleibt erhalten.",
            audioMissing: "Die Aufnahmen konnten nicht geladen werden, daher wird wenn möglich die Gerätestimme verwendet.",
            kind_letters: "Buchstaben",
            kind_words: "Wörter",
            kind_story: "Geschichte",
            kind_review: "Wiederholung",
            kind_small: "Kleine Buchstaben",
            mode_picture: "Sätze",
            mode_cloze: "Fehlendes Wort",
            mode_order: "Satz bauen",
            mode_mix: "Gemischte Sätze",
            locked: "Gesperrt",
            stars: "{n} von 3 Sternen",
            levelName: "Level {n}: {name}",
            notPlayed: "Noch nicht gespielt",
            close: "Zurück zur Karte",
            replay: "Noch einmal hören",
            readToMe: "Vorlesen",
            nextPage: "Nächste Seite",
            storyQuestions: "Fragen beantworten",
            listen: "Hören",
            levelDone: "Level geschafft!",
            nextLevel: "Nächstes Level",
            backToMap: "Zurück zur Karte",
            playAgainLevel: "Noch einmal",
            newSticker: "Neuer Sticker!",
            allDone: "Du hast den ganzen Pfad geschafft!",
            meet: "Ein neuer Buchstabe",
            progress: "Schritt {n} von {total}",
            tile: "Baustein {letter}",
            slot: "Kästchen {n}: {letter}. Zum Zurücklegen tippen.",
            emptySlot: "Leeres Kästchen {n}",
            picture: "Bild: {word}",
            hearPicture: "{word} hören",
            letterChoice: "Buchstabe {letter}",
            wordChoice: "Wort {word}",
            correct: "Richtig!",
            tryAgain: "Noch nicht ganz, versuch es nochmal.",
            gap: "fehlendes Wort"
        },
        ar: {
            title: "مغامرة القراءة",
            intro: "ثلاثة طرق إلى القراءة: الحروف، والكلمات، والجمل مع قصص صغيرة. مستوى قصير في كل مرة.",
            soundOn: "الصوت يعمل",
            soundOff: "الصوت مغلق",
            welcome: "مرحبا، أنا فِن! هيا نتعلم القراءة معا.",
            statStars: "نجوم",
            statStickers: "ملصقات",
            levelsDone: "من {total} مستويات مكتملة",
            playLevel: "العب المستوى {n}",
            playAgain: "العب المراجعة الأخيرة مرة أخرى",
            choosePath: "اختر طريقا",
            path_letters: "الحروف",
            path_words: "الكلمات",
            path_stories: "القصص",
            pathHint_letters: "تعرّف على الحروف وابحث عنها، ثم طابق أشكالها.",
            pathHint_words: "ابنِ الكلمات واقرأها بأربع طرق مختلفة.",
            pathHint_stories: "اقرأ الجمل، أكمل الفراغات، واستمتع بقصص قصيرة.",
            mapTitle: "طريقك",
            mapHint: "يمكنك إعادة المستويات المكتملة لتربح نجوما أكثر.",
            stickerTitle: "دفتر الملصقات",
            stickerHint: "كل مستوى تكمله يضيف ملصقا.",
            closeStickers: "أغلق دفتر الملصقات",
            grownups: "للكبار",
            howTitle: "كيف تعمل اللعبة",
            howText: "يمكن لعب الطرق الثلاثة بأي ترتيب. طريق الحروف يقدم بضعة حروف في كل مرة ثم أشكالها المتصلة. طريق الكلمات يبني كلمات كاملة من حروف جاهزة، ويكمل الحروف الناقصة، ويربط الكلمات بالصور. طريق القصص يبدأ بجمل قصيرة ثم قصص صغيرة مع أسئلة.",
            howText2: "كل كلمة واسم حرف وتعليمة تسجيل صوتي، لذلك تعمل بالطريقة نفسها على كل جهاز. كل جولة تعيد ما تعلمه الطفل سابقا، والأخطاء تجعله يعود أكثر.",
            soundsTitle: "الحروف حتى الآن",
            masteryNote: "الحروف الخضراء متقنة. الحروف البرتقالية تحتاج إلى تدريب أكثر وتعود أكثر.",
            noSounds: "تظهر الحروف هنا بعد أول مستوى للحروف.",
            settingsTitle: "الإعدادات",
            slowVoice: "صوت أبطأ",
            unlockAll: "افتح كل المستويات",
            autoFullscreen: "ملء الشاشة أثناء اللعب (يبعد الإعلانات)",
            fullscreen: "ملء الشاشة",
            exitFullscreen: "الخروج من ملء الشاشة",
            saved: "يُحفظ التقدم على هذا الجهاز. لكل لغة طرقها الخاصة.",
            saveFail: "تعذر حفظ التقدم في هذا المتصفح، لكن كل المستويات تعمل.",
            reset: "أعد ضبط تقدم هذه اللغة",
            resetConfirm: "هل تريد مسح كل التقدم في العربية؟ تبقى اللغات الأخرى كما هي.",
            audioMissing: "تعذر تحميل التسجيلات، لذلك يُستخدم صوت الجهاز عند الإمكان.",
            kind_letters: "الحروف",
            kind_words: "الكلمات",
            kind_story: "قصة",
            kind_review: "مراجعة",
            kind_small: "أشكال الحروف",
            mode_picture: "جمل",
            mode_cloze: "الكلمة الناقصة",
            mode_order: "ترتيب الكلمات",
            mode_mix: "جمل متنوعة",
            locked: "مقفل",
            stars: "{n} من 3 نجوم",
            levelName: "المستوى {n}: {name}",
            notPlayed: "لم يُلعب بعد",
            close: "العودة إلى الخريطة",
            replay: "استمع مرة أخرى",
            readToMe: "اقرأ لي",
            nextPage: "الصفحة التالية",
            storyQuestions: "أجب عن الأسئلة",
            listen: "استمع",
            levelDone: "أكملت المستوى!",
            nextLevel: "المستوى التالي",
            backToMap: "العودة إلى الخريطة",
            playAgainLevel: "العب مرة أخرى",
            newSticker: "ملصق جديد!",
            allDone: "أكملت الطريق كله!",
            meet: "حرف جديد",
            progress: "الخطوة {n} من {total}",
            tile: "بطاقة {letter}",
            slot: "المربع {n}: {letter}. اضغط لإرجاعه.",
            emptySlot: "مربع فارغ {n}",
            picture: "صورة: {word}",
            hearPicture: "استمع إلى {word}",
            letterChoice: "حرف {letter}",
            wordChoice: "كلمة {word}",
            correct: "صحيح!",
            tryAgain: "ليس تماما، حاول مرة أخرى.",
            gap: "كلمة ناقصة"
        }
    };
    const t = (key, vars = {}) => (strings[state.language][key] ?? strings.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");

    /* ---------- Content helpers ---------- */
    const L = () => content[state.language];
    const pathDef = (path = state.path) => L().paths[path];
    const levels = (path = state.path) => pathDef(path).levels;
    const phoneme = (grapheme) => L().phonemes[grapheme.toLocaleLowerCase()] ?? grapheme.toLocaleLowerCase();
    const shown = (word) => L().spelling?.[word] ?? word;
    const allWords = () => Object.keys(L().pictures);
    const allLetters = () => Object.keys(L().sounds);
    const pictureOf = (word) => L().pictures[word] ?? L().pictures[allWords().find((key) => wordKey(key) === wordKey(word))];
    const imageHtml = (pic, cls = "") => `<img class="pa-pic ${cls}" src="pics/${pic}.webp" alt="" draggable="false" width="240" height="240" />`;
    const levelItems = (level) => (level.items ? level.items.split(" ") : []);

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
    // Whether a word carries a letter where the question asks for it.
    function hasSound(word, grapheme, position) {
        const sounds = tilesFor(word).map(phoneme);
        const target = phoneme(grapheme);
        if (position === "start") return sounds[0] === target;
        if (position === "end") return sounds[sounds.length - 1] === target;
        return sounds.includes(target);
    }
    const anywhere = (word, grapheme) => tilesFor(word).map(phoneme).includes(phoneme(grapheme));
    const itemsUpTo = (path, index, kind) => levels(path).slice(0, index + 1).filter((level) => level.kind === kind).flatMap(levelItems);
    // Capital letters come first in every path; lowercase starts at the path's own turning point.
    const capitals = (path, index) => index < pathDef(path).lowercaseFrom;
    const cased = (text, path = round?.path ?? state.path, index = round?.index ?? 0) => (capitals(path, index) ? text.toLocaleUpperCase() : text);

    function letterShown(grapheme, pair = false) {
        if (L().caseless) return grapheme;
        if (capitals(round.path, round.index)) return grapheme.toLocaleUpperCase();
        return pair ? `${grapheme[0].toLocaleUpperCase()}${grapheme.slice(1)} ${grapheme}` : grapheme;
    }
    // Takes up to n items that pass `ok`, from the preferred list first, never two with the same key.
    function distinct(preferred, fallback, ok, keyOf, n, taken = []) {
        const keys = new Set(taken.map(keyOf));
        const out = [];
        for (const item of [...shuffle(preferred), ...shuffle(fallback)]) {
            if (out.length >= n) break;
            if (!ok(item) || keys.has(keyOf(item))) continue;
            keys.add(keyOf(item));
            out.push(item);
        }
        return out;
    }

    /* ---------- Saved progress ---------- */
    const freshJourney = () => ({
        paths: {
            letters: {},
            words: {},
            stories: {}
        },
        stats: {}
    });
    const LANGUAGES = content.languages;
    const knownLanguage = (value) => (LANGUAGES.includes(value) ? value : "en");
    const freshState = () => ({
        version: 4,
        language: "en",
        path: "letters",
        sound: true,
        slow: false,
        unlockAll: false,
        fullscreen: true,
        journeys: Object.fromEntries(LANGUAGES.map((lang) => [lang, freshJourney()]))
    });
    const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(100000, Math.floor(value))) : 0);
    let storageFailed = false;

    function cleanJourney(raw, lang) {
        const journey = freshJourney();
        if (!raw || typeof raw !== "object") return journey;
        for (const path of PATHS) {
            const total = content[lang].paths[path].levels.length;
            for (const [index, stars] of Object.entries(raw.paths?.[path] || {})) {
                if (/^\d+$/.test(index) && Number(index) < total) journey.paths[path][index] = Math.max(1, Math.min(3, count(stars)));
            }
        }
        for (const [key, value] of Object.entries(raw.stats || {})) {
            if (key.length < 40 && value && typeof value === "object") journey.stats[key] = {
                c: count(value.c),
                w: count(value.w)
            };
        }
        return journey;
    }
    // Rebuilds finished levels from what an earlier version knew: learned letters, finished word sets and stories.
    function rebuild(lang, learned, wordSets, stories) {
        const journey = freshJourney();
        const paths = content[lang].paths;
        paths.letters.levels.every((level, i) => {
            const next = paths.letters.levels.slice(i + 1).find((item) => item.kind === "letters");
            const ok = level.kind === "letters" ? levelItems(level).every((item) => learned.has(item)) :
                level.kind === "review" ? Boolean(next && levelItems(next).every((item) => learned.has(item))) : false;
            if (ok) journey.paths.letters[i] = 2;
            return ok;
        });
        let remaining = wordSets;
        paths.words.levels.every((level, i) => {
            const ok = level.kind === "words" ? remaining-- > 0 : remaining > 0;
            if (ok) journey.paths.words[i] = 2;
            return ok;
        });
        paths.stories.levels.forEach((level, i) => {
            if (level.kind === "story" && stories.has(level.story)) journey.paths.stories[i] = 2;
        });
        return journey;
    }
    // The single path of version 3, in order: s = letters, w = words, t = story, r = review.
    const LEGACY = {
        en: "s:s a t|s:p i n|w|s:m d g o|w|t:dogpig|s:c k e u|w|s:r h b f|w|t:cathat|r|s:l j v w|w|s:x y z qu|t:foxbox|s:sh ch th ng ck|w|s:ee oo ar oa|w|t:moonboat|r",
        de: "s:m a o|s:l i s|w|s:e r n t|w|t:lotte|s:u d h b|w|s:f w k p|w|t:hund|r|s:g z j v|w|s:sch ch ei au|w|s:ie eu ä ö ü|w|t:eule|s:st sp qu pf|w|t:stern|r"
    };

    function fromVersion3(raw, lang) {
        const finishedBefore = raw?.done || {};
        const learned = new Set();
        const stories = new Set();
        let wordSets = 0;
        LEGACY[lang].split("|").forEach((entry, i) => {
            if (finishedBefore[i] === undefined) return;
            const [kind, items] = entry.split(":");
            if (kind === "s") items.split(" ").forEach((item) => learned.add(item));
            if (kind === "w") wordSets += 1;
            if (kind === "t") stories.add(items);
        });
        const journey = rebuild(lang, learned, wordSets, stories);
        journey.stats = cleanJourney(raw, lang).stats;
        return journey;
    }

    function fromVersion2(raw, lang) {
        if (!raw || typeof raw !== "object") return freshJourney();
        const words = new Set((raw.words || []).map((word) => wordKey(String(word))));
        const sets = content[lang].paths.words.levels.filter((level) => level.kind === "words" && levelItems(level).filter((word) => words.has(wordKey(word))).length >= 2).length;
        return rebuild(lang, new Set((raw.sounds || []).map(String)), sets, new Set());
    }

    function load() {
        const state = freshState();
        try {
            const saved = JSON.parse(localStorage.getItem(KEY));
            if (saved?.version === 4) {
                state.language = knownLanguage(saved.language);
                state.path = PATHS.includes(saved.path) ? saved.path : "letters";
                state.sound = saved.sound !== false;
                state.slow = saved.slow === true;
                state.unlockAll = saved.unlockAll === true;
                state.fullscreen = saved.fullscreen !== false;
                for (const lang of LANGUAGES) state.journeys[lang] = cleanJourney(saved.journeys?.[lang], lang);
                return state;
            }
            const v3 = JSON.parse(localStorage.getItem("phonicsAdventure.v3"));
            if (v3?.version === 3) {
                state.language = knownLanguage(v3.language);
                state.sound = v3.sound !== false;
                state.slow = v3.slow === true;
                for (const lang of ["en", "de"]) state.journeys[lang] = fromVersion3(v3.journeys?.[lang], lang);
                state.journeys.ar = freshJourney();
                return state;
            }
            const v2 = JSON.parse(localStorage.getItem("phonicsAdventure.v2"));
            if (v2?.version === 2) {
                state.language = knownLanguage(v2.language);
                state.sound = v2.audio !== false;
                for (const lang of ["en", "de"]) state.journeys[lang] = fromVersion2(v2.journeys?.[lang], lang);
                state.journeys.ar = freshJourney();
            }
        } catch {
            /* Unreadable storage must never block play. */
        }
        return state;
    }
    const state = load();
    const journey = () => state.journeys[state.language];
    const done = (path = state.path) => journey().paths[path];

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
            storageFailed = false;
        } catch {
            storageFailed = true;
        }
        $("save-note").textContent = t(storageFailed ? "saveFail" : "saved");
    }

    /* ---------- Sound ---------- */
    // Clips play through one Web Audio channel that the first tap unlocks, which is what tablets allow reliably.
    // A clip that is not ready in time is skipped: the game never waits on sound to move on.
    const speechReady = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);
    const Context = window.AudioContext || window.webkitAudioContext;
    const READY_WAIT = 1500;
    let context = null;
    let audioToken = 0;
    let audioFailed = false;
    let currentFinish = null;
    const buffers = new Map();
    const elements = new Map();
    const clipEntry = (id) => window.PhonicsAudio?.[state.language]?.[id];
    const clipSrc = (id) => clipEntry(id) && `audio/${state.language}/${clipEntry(id)[0]}`;

    function clipText(id) {
        const [kind, ...rest] = id.split(":");
        if (kind === "w") return rest.join(":");
        if (kind === "line") return L().lines[rest[0]];
        if (kind === "st") return L().stories[rest[0]]?.pages[Number(rest[1])]?.text;
        if (kind === "q") return L().stories[rest[0]]?.questions[Number(rest[1])]?.text;
        if (kind === "sn") return L().sentences[Number(rest[0])]?.text;
        if (kind === "in") return L().sounds[rest[0]]?.[0];
        if (kind === "ph") return rest[0].toLocaleUpperCase();
        return null;
    }
    const audioContext = () => {
        if (!context && Context) {
            try {
                context = new Context();
            } catch {
                /* Fall back to media elements. */
            }
        }
        return context;
    };

    function unlockAudio() {
        const ctx = audioContext();
        if (!ctx) return;
        if (ctx.state !== "running") ctx.resume().catch(() => {});
        // iOS needs a sound started inside the tap itself; a one-sample silent buffer is enough.
        const source = ctx.createBufferSource();
        source.buffer = ctx.createBuffer(1, 1, 22050);
        source.connect(ctx.destination);
        source.start(0);
    }
    document.addEventListener("pointerdown", unlockAudio, {
        capture: true
    });
    document.addEventListener("keydown", unlockAudio, {
        capture: true
    });

    function noteFailure() {
        if (audioFailed) return;
        audioFailed = true;
        $("audio-note").textContent = t("audioMissing");
    }

    function loadBuffer(id) {
        const src = clipSrc(id);
        const ctx = audioContext();
        if (!src || !ctx) return Promise.resolve(null);
        if (!buffers.has(src)) {
            buffers.set(src, fetch(src)
                .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.status))))
                .then((data) => new Promise((resolve, reject) => ctx.decodeAudioData(data, resolve, reject)))
                .catch(() => {
                    buffers.delete(src);
                    noteFailure();
                    return null;
                }));
        }
        return buffers.get(src);
    }

    function element(id) {
        const src = clipSrc(id);
        if (!src) return null;
        if (!elements.has(src)) {
            const audio = new Audio();
            audio.preload = "auto";
            audio.src = src;
            elements.set(src, audio);
        }
        return elements.get(src);
    }
    const preload = (ids) => {
        if (!state.sound) return;
        ids.filter(Boolean).forEach((id) => (audioContext() ? loadBuffer(id) : element(id)));
    };

    function stopAudio() {
        audioToken += 1;
        if (currentFinish) currentFinish();
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
            utterance.onend = utterance.onerror = () => {
                clearTimeout(timer);
                resolve();
            };
            if (token === audioToken) window.speechSynthesis.speak(utterance);
            else resolve();
        });
    }
    // Plays one clip; a new clip or a stop always ends the one before it, so two never overlap.
    function playClip(id, token, onTime) {
        return new Promise((resolve) => {
            if (token !== audioToken || !state.sound) return resolve();
            if (!clipEntry(id)) {
                speakFallback(id, token).then(resolve);
                return;
            }
            if (currentFinish) currentFinish();
            const rate = state.slow ? 0.85 : 1;
            let frame = 0;
            let timer = 0;
            let stopSound = () => {};
            let ended = false;
            const finish = () => {
                if (ended) return;
                ended = true;
                clearTimeout(timer);
                cancelAnimationFrame(frame);
                stopSound();
                if (currentFinish === finish) currentFinish = null;
                resolve();
            };
            currentFinish = finish;
            const follow = (now) => {
                if (!onTime) return;
                const tick = () => {
                    onTime(now());
                    frame = requestAnimationFrame(tick);
                };
                frame = requestAnimationFrame(tick);
            };
            const ctx = audioContext();
            if (ctx) {
                timer = setTimeout(finish, READY_WAIT);
                Promise.all([loadBuffer(id), ctx.state === "running" ? null : ctx.resume().catch(() => {})]).then(([buffer]) => {
                    if (ended) return;
                    clearTimeout(timer);
                    if (!buffer || ctx.state !== "running") return finish();
                    const source = ctx.createBufferSource();
                    source.buffer = buffer;
                    source.playbackRate.value = rate;
                    source.connect(ctx.destination);
                    const startedAt = ctx.currentTime;
                    source.onended = finish;
                    stopSound = () => {
                        source.onended = null;
                        try {
                            source.stop();
                        } catch {
                            /* Already stopped. */
                        }
                    };
                    source.start();
                    timer = setTimeout(finish, (buffer.duration / rate) * 1000 + 400);
                    follow(() => (ctx.currentTime - startedAt) * rate);
                });
                return;
            }
            // Browsers without Web Audio use plain media elements with the same rules.
            const audio = element(id);
            stopSound = () => {
                audio.onended = audio.onerror = audio.onplaying = null;
                audio.pause();
            };
            timer = setTimeout(finish, READY_WAIT);
            audio.onplaying = () => {
                clearTimeout(timer);
                timer = setTimeout(finish, (clipEntry(id)[1] / rate) * 1000 + 400);
            };
            audio.onended = finish;
            audio.onerror = () => {
                noteFailure();
                finish();
            };
            try {
                audio.currentTime = 0;
            } catch {
                /* Not yet seekable. */
            }
            audio.playbackRate = rate;
            follow(() => audio.currentTime);
            const started = audio.play();
            if (started) started.catch(finish);
        });
    }
    // Plays clips in order; resolves true when the whole sequence finished uninterrupted.
    async function say(ids, {
        onTime = null,
        gap = 140
    } = {}) {
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
        const ctx = state.sound && audioContext();
        if (!ctx || ctx.state !== "running") return;
        try {
            const notes = {
                win: [523.25, 659.25, 783.99, 1046.5],
                soft: [311.13, 261.63],
                fanfare: [523.25, 659.25, 783.99, 659.25, 1046.5]
            } [kind];
            notes.forEach((frequency, index) => {
                const oscillator = ctx.createOscillator();
                const gain = ctx.createGain();
                const start = ctx.currentTime + index * (kind === "fanfare" ? 0.13 : 0.08);
                oscillator.type = kind === "soft" ? "sine" : "triangle";
                oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.08, start + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, start + (kind === "soft" ? 0.22 : 0.3));
                oscillator.connect(gain).connect(ctx.destination);
                oscillator.start(start);
                oscillator.stop(start + 0.35);
            });
        } catch {
            /* Visual feedback is enough when audio output is blocked. */
        }
    }

    /* ---------- Paths, map and sticker book ---------- */
    const unlocked = (index, path = state.path) => state.unlockAll || index === 0 || done(path)[index - 1] !== undefined || done(path)[index] !== undefined;
    const nextLevelIndex = (path = state.path) => {
        const index = levels(path).findIndex((_, i) => done(path)[i] === undefined);
        return index === -1 ? levels(path).length - 1 : index;
    };
    const finished = (path) => Object.keys(done(path)).length;
    const starsIn = (path) => Object.values(done(path)).reduce((sum, n) => sum + n, 0);

    function levelName(level, index, path = state.path) {
        if (level.kind === "letters") return levelItems(level).map((item) => cased(item, path, index)).join(" ");
        if (level.kind === "story") return L().stories[level.story].title;
        if (level.kind === "sentences") return t(`mode_${level.mode}`);
        if (level.kind === "words") return `${levelItems(level).slice(0, 2).map((word) => cased(shown(word), path, index)).join(", ")} …`;
        return t(`kind_${level.kind}`);
    }

    function levelIcon(level, index, path = state.path) {
        if (level.kind === "letters") return `<span class="pa-node-letters">${escape(levelName(level, index, path))}</span>`;
        if (level.kind === "small") return '<span class="pa-node-letters">Aa</span>';
        if (level.kind === "words") return imageHtml(pictureOf(levelItems(level)[0]));
        if (level.kind === "sentences") return imageHtml(pictureOf(L().sentences[Number(levelItems(level)[0])].answer));
        if (level.kind === "story") return imageHtml(L().stories[level.story].cover);
        return imageHtml("trophy");
    }
    const starsHtml = (n, cls = "") => `<span class="pa-stars ${cls}" aria-hidden="true">${[1, 2, 3].map((i) => `<i class="${i <= n ? "is-on" : ""}"></i>`).join("")}</span>`;
    const stickerOf = (path, index) => {
        const offset = PATHS.slice(0, PATHS.indexOf(path)).reduce((sum, item) => sum + levels(item).length, 0);
        return content.stickers[(offset + index) % content.stickers.length];
    };
    const pathIcon = (path) => path === "letters" ? `<span class="pa-path-letters">${L().caseless ? Object.keys(L().sounds).slice(0, 3).join(" ") : "ABC"}</span>` :
        imageHtml(path === "words" ? pictureOf(levelItems(levels("words")[0])[0]) : "openbook");

    function renderPaths() {
        $("path-tabs").innerHTML = PATHS.map((path) => `<button type="button" role="tab" class="pa-path-tab" data-path="${path}" aria-selected="${path === state.path}" tabindex="${path === state.path ? 0 : -1}">
            <span class="pa-path-icon" aria-hidden="true">${pathIcon(path)}</span>
            <span class="pa-path-text"><strong>${t(`path_${path}`)}</strong><small>${t(`pathHint_${path}`)}</small>
            <span class="pa-path-meta"><span class="pa-star-icon" aria-hidden="true"></span>${starsIn(path)} · ${finished(path)}/${levels(path).length}</span></span></button>`).join("");
        $("path-tabs").querySelectorAll("[data-path]").forEach((button, i, all) => {
            button.onclick = () => choosePath(button.dataset.path);
            button.onkeydown = (event) => {
                const step = {
                    ArrowRight: 1,
                    ArrowDown: 1,
                    ArrowLeft: -1,
                    ArrowUp: -1
                } [event.key];
                if (!step) return;
                event.preventDefault();
                const next = all[(i + step + all.length) % all.length].dataset.path;
                choosePath(next);
                $("path-tabs").querySelector(`[data-path="${next}"]`).focus();
            };
        });
    }

    function choosePath(path) {
        if (!PATHS.includes(path)) return;
        state.path = path;
        save();
        renderMap();
    }

    function renderMap() {
        renderPaths();
        const current = nextLevelIndex();
        $("level-map").innerHTML = `<svg class="pa-map-path" aria-hidden="true"></svg><ol class="pa-nodes">${levels().map((level, index) => {
            const stars = done()[index];
            const open = unlocked(index);
            const status = stars !== undefined ? "is-done" : index === current && open ? "is-current" : open ? "is-open" : "is-locked";
            const label = `${t("levelName", { n: index + 1, name: levelName(level, index) })}. ${!open ? t("locked") : stars !== undefined ? t("stars", { n: stars }) : t("notPlayed")}`;
            return `<li class="pa-node ${status} pa-kind-${level.kind}">
                <button type="button" data-level="${index}" ${open ? "" : "disabled"} aria-label="${escape(label)}">${open ? levelIcon(level, index) : imageHtml("lock", "pa-lock")}<span class="pa-node-number" aria-hidden="true">${index + 1}</span></button>
                ${index === current && open ? '<img class="pa-node-finn" src="assets/finn.webp" alt="" width="64" height="58" />' : ""}
                <span class="pa-node-label" aria-hidden="true">${escape(levelName(level, index))}</span>${starsHtml(stars || 0)}</li>`;
        }).join("")}</ol>`;
        $("level-map").querySelectorAll("[data-level]").forEach((button) => {
            button.onclick = () => startLevel(Number(button.dataset.level));
        });
        layoutMap();
        $("map-title").textContent = `${t("mapTitle")}: ${t(`path_${state.path}`)}`;
        $("stat-level").textContent = finished(state.path);
        $("stat-level-label").textContent = t("levelsDone", {
            total: levels().length
        });
        $("stat-stars").textContent = PATHS.reduce((sum, path) => sum + starsIn(path), 0);
        $("stat-stickers").textContent = PATHS.reduce((sum, path) => sum + finished(path), 0);
        $("journey-fill").style.width = `${(finished(state.path) / levels().length) * 100}%`;
        $("play-next-label").textContent = finished(state.path) === levels().length ? t("playAgain") : `${t(`path_${state.path}`)} · ${t("playLevel", { n: current + 1 })}`;
        renderStickers();
        renderMastery();
    }

    function renderStickers() {
        $("sticker-book").innerHTML = PATHS.map((path) => `<div class="pa-sticker-group"><h3>${t(`path_${path}`)}</h3><div class="pa-sticker-grid">${levels(path).map((_, index) => {
            const won = done(path)[index] !== undefined;
            return `<span class="pa-sticker ${won ? "is-won" : ""}">${imageHtml(stickerOf(path, index))}</span>`;
        }).join("")}</div></div>`).join("");
        app.querySelectorAll(".pa-sticker-count").forEach((node) => {
            node.textContent = PATHS.reduce((sum, path) => sum + finished(path), 0);
        });
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
        const doneCount = levels().findIndex((_, i) => done()[i] === undefined);
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
        if ($("level-map").clientWidth !== mapWidth) {
            mapWidth = $("level-map").clientWidth;
            layoutMap();
        }
    }).observe($("level-map"));

    function renderMastery() {
        const reached = Math.max(-1, ...Object.keys(done("letters")).map(Number));
        const learned = reached >= 0 ? itemsUpTo("letters", reached, "letters") : [];
        $("mastery").innerHTML = learned.length ? learned.map((grapheme) => {
            const stat = journey().stats[grapheme] || {
                c: 0,
                w: 0
            };
            const level = stat.c >= 2 && stat.w <= stat.c / 3 ? "is-secure" : stat.w > 0 ? "is-practise" : "";
            return `<span class="pa-mastery-item ${level}">${escape(cased(grapheme, "letters", reached))}</span>`;
        }).join("") : `<p class="pa-note">${t("noSounds")}</p>`;
    }

    /* ---------- Building a round ---------- */
    function weightedSample(items, weight, n) {
        const pool = items.map((item) => ({
            item,
            w: Math.max(0.2, weight(item)) * (0.6 + Math.random())
        }));
        return pool.sort((a, b) => b.w - a.w).slice(0, n).map(({
            item
        }) => item);
    }
    const needsPractice = (key) => {
        const stat = journey().stats[key] || {
            c: 0,
            w: 0
        };
        return 1 + stat.w * 2.5 - Math.min(stat.c, 6) * 0.3;
    };
    // Letter questions draw pictures from the whole picture set, so the same letter brings new words each time.
    function letterTask(grapheme, known, type) {
        const [example, position] = L().sounds[grapheme];
        const candidates = allWords().filter((word) => hasSound(word, grapheme, position));
        const word = candidates.length ? pick(candidates) : example;
        if (type === "pickLetter") {
            // A distractor may appear elsewhere in the word, just not where the question looks.
            const ok = (item) => phoneme(item) !== phoneme(grapheme) && !(position === "in" ? anywhere(word, item) : hasSound(word, item, position));
            const others = distinct(known, allLetters(), ok, phoneme, 2, [grapheme]);
            return {
                type,
                grapheme,
                word,
                position,
                options: shuffle([grapheme, ...others]),
                key: grapheme
            };
        }
        if (type === "hunt") {
            // Same-sized tiles first (sh among th and ch); "sch" has no three-letter neighbours, so any tile can fill in.
            const differs = (item) => phoneme(item) !== phoneme(grapheme);
            const sameSize = distinct(known, allLetters(), (item) => differs(item) && item.length === grapheme.length, phoneme, 5, [grapheme]);
            const others = sameSize.length >= 3 ? sameSize : [...sameSize, ...distinct(known, allLetters(), differs, phoneme, 5 - sameSize.length, [grapheme, ...sameSize])];
            const cells = shuffle([grapheme, grapheme, grapheme, ...Array.from({
                length: 5
            }, (_, i) => others[i % others.length])]);
            return {
                type,
                grapheme,
                cells,
                key: grapheme
            };
        }
        const ok = (item) => Boolean(pictureOf(item)) && !(position === "in" ? anywhere(item, grapheme) : hasSound(item, grapheme, position));
        const others = distinct(allWords(), [], ok, pictureOf, 2, [word]);
        return {
            type: "pickPicture",
            grapheme,
            word,
            position,
            options: shuffle([word, ...others]),
            key: grapheme
        };
    }

    function meetTask(grapheme, known) {
        const others = distinct(known, allLetters(), (item) => phoneme(item) !== phoneme(grapheme), phoneme, 2, [grapheme]);
        return {
            type: "meet",
            grapheme,
            options: shuffle([grapheme, ...others]),
            key: grapheme
        };
    }
    // Similar-looking words make children read every letter instead of guessing from the first one.
    function similarWords(word, pool) {
        const tiles = tilesFor(word).map((tile) => tile.toLocaleLowerCase());
        const score = (item) => {
            const other = tilesFor(item).map((tile) => tile.toLocaleLowerCase());
            return tiles.reduce((sum, tile, i) => sum + (other[i] === tile ? 2 : other.includes(tile) ? 0.5 : 0), 0) + Math.random();
        };
        const ranked = pool.filter((item) => pictureOf(item) !== pictureOf(word)).sort((a, b) => score(b) - score(a)).slice(0, 4);
        return distinct(ranked, allWords(), (item) => item !== word, pictureOf, 2, [word]);
    }

    function wordTask(word, pool, type, index) {
        const tiles = tilesFor(word);
        const key = `w:${wordKey(word)}`;
        if (type === "build") {
            const extra = index >= 4 && tiles.length <= 4 ?
                distinct(allLetters().filter((item) => item.length === 1), [], (item) => !tiles.some((tile) => tile.toLocaleLowerCase() === item), (item) => item, 1) : [];
            let bank = tiles.map((text, id) => ({
                id,
                text
            })).concat(extra.map((text, i) => ({
                id: tiles.length + i,
                text
            })));
            for (let tries = 0; tries < 6; tries += 1) {
                bank = shuffle(bank);
                if (bank.map((tile) => tile.text).join("") !== tiles.join("") || bank.length === 1) break;
            }
            return {
                type,
                word,
                tiles,
                bank,
                key
            };
        }
        if (type === "missing") {
            const gap = Math.floor(Math.random() * tiles.length);
            const missing = tiles[gap].toLocaleLowerCase();
            const sameKind = allLetters().filter((item) => (item.length > 1) === (missing.length > 1));
            const others = distinct(sameKind, allLetters(), (item) => phoneme(item) !== phoneme(missing), phoneme, 2, [missing]);
            return {
                type,
                word,
                tiles,
                gap,
                grapheme: missing,
                options: shuffle([missing, ...others]),
                key
            };
        }
        return {
            type,
            word,
            tiles,
            options: shuffle([word, ...similarWords(word, pool)]),
            key
        };
    }

    function sentenceTask(index, type) {
        const item = L().sentences[index];
        const tokens = item.text.split(/\s+/);
        const answerAt = tokens.findIndex((token) => wordKey(token) === wordKey(item.answer));
        const inSentence = new Set(tokens.map(wordKey));
        const key = `s:${index}`;
        if (type === "order") {
            let pieces = tokens.map((text, id) => ({
                id,
                text
            }));
            for (let tries = 0; tries < 6; tries += 1) {
                pieces = shuffle(pieces);
                if (pieces.map((piece) => piece.text).join(" ") !== item.text) break;
            }
            return {
                type,
                index,
                tokens,
                pieces,
                key
            };
        }
        const answers = L().sentences.map((other) => other.answer);
        const others = distinct(answers, allWords(), (word) => !inSentence.has(wordKey(word)) && Boolean(pictureOf(word)), pictureOf, 2, [item.answer]);
        return {
            type: type === "cloze" ? "cloze" : "sentencePic",
            index,
            tokens,
            answerAt,
            answer: item.answer,
            options: shuffle([item.answer, ...others]),
            key
        };
    }

    function buildRound(path, index) {
        const level = levels(path)[index];
        const items = levelItems(level);
        const tasks = [];
        if (path === "letters") {
            const known = itemsUpTo(path, index, "letters");
            if (level.kind === "letters") {
                items.forEach((grapheme) => tasks.push(meetTask(grapheme, known)));
                const practice = items.map((grapheme, i) => letterTask(grapheme, known, i % 2 ? "pickLetter" : "pickPicture"));
                practice.push(letterTask(pick(items), known, "hunt"));
                const earlier = known.filter((item) => !items.includes(item));
                const review = weightedSample(earlier, needsPractice, 2).map((grapheme) => letterTask(grapheme, known, pick(["pickLetter", "pickPicture", "hunt"])));
                tasks.push(...shuffle([...practice, ...review]));
            } else if (level.kind === "small") {
                for (const grapheme of weightedSample(items, needsPractice, 8)) {
                    const others = distinct(items, allLetters(), (item) => item !== grapheme, (item) => item, 2, [grapheme]);
                    tasks.push({
                        type: "matchCase",
                        grapheme,
                        options: shuffle([grapheme, ...others]),
                        key: grapheme
                    });
                }
            } else {
                const types = ["pickLetter", "pickPicture", "hunt"];
                weightedSample(known, needsPractice, 7).forEach((grapheme, i) => tasks.push(letterTask(grapheme, known, types[i % 3])));
            }
        } else if (path === "words") {
            const pool = itemsUpTo(path, index, "words");
            const source = level.kind === "words" ? items : pool;
            const chosen = weightedSample(source, (word) => needsPractice(`w:${wordKey(word)}`), Math.min(source.length, level.kind === "words" ? 5 : 6));
            const types = shuffle(["build", "missing", "read", "match"]);
            chosen.forEach((word, i) => tasks.push(wordTask(word, pool, types[i % 4], index)));
            if (chosen.length < 5) chosen.forEach((word, i) => tasks.push(wordTask(word, pool, types[(i + 2) % 4], index)));
            tasks.splice(0, tasks.length, ...shuffle(tasks));
        } else if (level.kind === "story") {
            const story = L().stories[level.story];
            story.pages.forEach((_, page) => tasks.push({
                type: "story",
                story: level.story,
                page
            }));
            story.questions.forEach((item, i) => tasks.push({
                type: "question",
                story: level.story,
                question: i,
                answer: item.answer,
                options: shuffle([item.answer, ...item.others]),
                key: `q:${level.story}:${i}`
            }));
        } else {
            const seen = levels(path).slice(0, index + 1).filter((item) => item.kind === "sentences").flatMap(levelItems).map(Number);
            const source = level.kind === "sentences" ? items.map(Number) : seen.length ? seen : L().sentences.map((_, i) => i);
            const mode = level.kind === "sentences" ? level.mode : "mix";
            const cycle = ["picture", "cloze", "order"];
            weightedSample(source, (i) => needsPractice(`s:${i}`), 6).forEach((sentence, i) => tasks.push(sentenceTask(sentence, mode === "mix" ? cycle[i % 3] : mode)));
        }
        return tasks;
    }

    /* ---------- Playing a round ---------- */
    let round = null;

    function setGuide(text) {
        $("play-title").textContent = text;
    }

    function announce(text) {
        $("announcer").textContent = "";
        requestAnimationFrame(() => {
            $("announcer").textContent = text;
        });
    }

    function setInert(on) {
        document.querySelectorAll("body > nav, body > footer, body > .skip-link, .pa > .breadcrumbs, #phonics-app > :not(#play):not(#sticker-dialog)").forEach((node) => {
            node.inert = on;
        });
    }
    // The sticker book opens over whatever is on screen, the map or a round, and returns there when closed.
    const dialog = $("sticker-dialog");
    let returnFocus = null;

    function openStickers() {
        stopAudio();
        renderStickers();
        returnFocus = document.activeElement;
        dialog.hidden = false;
        document.body.classList.add("pa-playing");
        setInert(true);
        play.inert = true;
        $("close-stickers").focus({
            preventScroll: true
        });
    }

    function closeStickers() {
        dialog.hidden = true;
        play.inert = false;
        if (!round) {
            setInert(false);
            document.body.classList.remove("pa-playing");
        }
        returnFocus?.focus({
            preventScroll: true
        });
    }
    // Full screen shows only the game, so page ads cannot appear over a round; the map keeps the normal page.
    const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
    const canFullscreen = Boolean(app.requestFullscreen || app.webkitRequestFullscreen);

    function enterFullscreen() {
        if (!canFullscreen || fullscreenElement()) return;
        try {
            const request = app.requestFullscreen ? app.requestFullscreen({
                navigationUI: "hide"
            }) : app.webkitRequestFullscreen();
            request?.catch?.(() => {});
        } catch {
            /* The browser said no; the round still works. */
        }
    }

    function exitFullscreen() {
        if (!fullscreenElement()) return;
        try {
            const exit = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen();
            exit?.catch?.(() => {});
        } catch {
            /* Already left. */
        }
    }

    function syncFullscreen() {
        const on = Boolean(fullscreenElement());
        $("fullscreen-toggle").hidden = !canFullscreen;
        $("fullscreen-toggle").setAttribute("aria-pressed", String(on));
        $("fullscreen-toggle").setAttribute("aria-label", t(on ? "exitFullscreen" : "fullscreen"));
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    document.addEventListener("webkitfullscreenchange", syncFullscreen);

    function startLevel(index, path = state.path) {
        if (!unlocked(index, path)) return;
        if (state.fullscreen) enterFullscreen();
        syncFullscreen();
        round = {
            path,
            index,
            tasks: buildRound(path, index),
            step: 0,
            mistakes: 0,
            taskMistakes: 0,
            busy: false,
            replay: null
        };
        play.hidden = false;
        document.body.classList.add("pa-playing");
        setInert(true);
        $("play-level").textContent = `${index + 1}`;
        $("close-play").setAttribute("aria-label", t("close"));
        app.querySelector(".pa-sticker-mini").setAttribute("aria-label", t("stickerTitle"));
        $("replay").setAttribute("aria-label", t("replay"));
        $("replay").focus({
            preventScroll: true
        });
        const kind = levels(path)[index].kind;
        const intro = {
            letters: "line:sounds",
            small: "line:small",
            words: "line:words",
            sentences: "line:sentences",
            story: "line:storyStart",
            review: "line:review"
        } [kind];
        showTask(intro);
    }

    function closePlay() {
        stopAudio();
        exitFullscreen();
        round = null;
        play.hidden = true;
        document.body.classList.remove("pa-playing");
        setInert(false);
        renderMap();
        const current = $("level-map").querySelector(".is-current button") || $("play-next");
        current.focus({
            preventScroll: true
        });
    }

    function updateProgress() {
        const total = round.tasks.length;
        $("play-progress-fill").style.width = `${(round.step / total) * 100}%`;
        $("play-progress").setAttribute("aria-valuemax", String(total));
        $("play-progress").setAttribute("aria-valuenow", String(round.step));
        $("play-progress").setAttribute("aria-label", t("progress", {
            n: Math.min(round.step + 1, total),
            total
        }));
    }
    const renderers = {};

    function showTask(lead = null) {
        if (!round) return;
        updateProgress();
        round.busy = false;
        round.taskMistakes = 0;
        round.keyboard = null;
        if (round.step >= round.tasks.length) return finishRound();
        const task = round.tasks[round.step];
        stage.className = `pa-stage pa-task-${task.type}`;
        renderers[task.type](task, lead);
        const next = round.tasks[round.step + 1];
        if (next) preload(clipsFor(next));
    }

    function clipsFor(task) {
        if (["meet", "matchCase", "hunt"].includes(task.type)) return [`in:${task.grapheme}`, `ph:${task.grapheme}`];
        if (task.type === "story") return [`st:${task.story}:${task.page}`];
        if (task.type === "question") return [`q:${task.story}:${task.question}`];
        if (task.index !== undefined) return [`sn:${task.index}`, `cz:${task.index}`];
        return [task.word && `w:${wordKey(task.word)}`, ...(task.tiles || []).map((tile) => `ph:${tile.toLocaleLowerCase()}`)];
    }
    const questionLine = (task) => task.type === "pickLetter" ? {
        start: "line:startQ",
        end: "line:endQ",
        in: "line:inQ"
    } [task.position] : {
        start: "line:findStart",
        end: "line:findEnd",
        in: "line:findIn"
    } [task.position];
    const lineText = (id) => L().lines[id.slice(5)];
    // Records the first try of each task for the mastery chart and spaced review.
    function record(task, correct) {
        if (!task.key) return;
        const stat = journey().stats[task.key] ||= {
            c: 0,
            w: 0
        };
        if (correct && round.taskMistakes === 0) stat.c += 1;
        if (!correct && round.taskMistakes === 1) stat.w += 1;
    }
    async function success(task, button, clips = []) {
        round.busy = true;
        record(task, true);
        button?.classList.add("is-right");
        stopAudio();
        tone("win");
        burst(button || stage);
        announce(t("correct"));
        // The chime finishes before anyone speaks, so two sounds never overlap.
        if (state.sound) await sleep(420);
        if (!round || round.tasks[round.step] !== task) return;
        await say([...clips, `line:praise${1 + Math.floor(Math.random() * 8)}`]);
        if (!round || round.tasks[round.step] !== task) return;
        await sleep(state.sound ? 250 : 650);
        if (!round || round.tasks[round.step] !== task) return;
        round.step += 1;
        showTask();
    }
    async function mistake(task, button, clips = []) {
        const activeRound = round;
        const isCurrent = () => round === activeRound && round?.tasks[round.step] === task;
        round.taskMistakes += 1;
        if (task.type !== "story") round.mistakes += 1;
        record(task, false);
        stopAudio();
        tone("soft");
        announce(t("tryAgain"));
        if (button) {
            button.classList.remove("is-wrong");
            void button.offsetWidth;
            button.classList.add("is-wrong");
        }
        if (state.sound) await sleep(300);
        if (!isCurrent()) return;
        const finishedSaying = await say([...clips, `line:retry${1 + Math.floor(Math.random() * 4)}`]);
        if (!isCurrent()) return;
        if (round.taskMistakes >= 2) {
            stage.querySelectorAll("[data-answer='true']:not(:disabled)").forEach((node) => node.classList.add("is-hint"));
            if (finishedSaying) say("line:hereItIs");
        } else if (finishedSaying && round?.replay) round.replay();
    }

    function burst(anchor) {
        if (reducedMotion()) return;
        const rect = anchor.getBoundingClientRect();
        const layer = document.createElement("div");
        layer.className = "pa-burst";
        layer.style.left = `${rect.left + rect.width / 2}px`;
        layer.style.top = `${rect.top + rect.height / 2}px`;
        layer.innerHTML = Array.from({
            length: 14
        }, (_, i) => `<i style="--a:${(i / 14) * 360}deg;--d:${60 + Math.random() * 50}px"></i>`).join("");
        document.body.append(layer);
        setTimeout(() => layer.remove(), 900);
    }

    function pulse(node) {
        node.classList.remove("pa-pulse");
        void node.offsetWidth;
        node.classList.add("pa-pulse");
    }
    const pictureButton = (word) => `<div class="pa-prompt-picture"><button type="button" class="pa-card pa-card-large" id="prompt-picture" aria-label="${escape(t("hearPicture", { word: shown(word) }))}">${imageHtml(pictureOf(word))}<span class="pa-card-badge" aria-hidden="true"></span></button></div>`;
    // The prompt card shows the letter, or, when it must be found by ear, a speaker that says its name.
    const listenCard = (grapheme) => (state.sound ?
        `<div class="pa-prompt-sound"><button type="button" class="pa-big-letter pa-big-letter-small pa-listen-card" id="prompt-sound" aria-label="${escape(t("listen"))}"><span aria-hidden="true"></span></button></div>` :
        bigLetter(grapheme));
    const bigLetter = (grapheme, small = true) => `<div class="pa-prompt-sound"><button type="button" class="pa-big-letter ${small ? "pa-big-letter-small" : ""}" id="prompt-sound" aria-label="${escape(t("listen"))}: ${escape(grapheme)}">${escape(grapheme)}</button></div>`;
    // Marks where the letter sits in the example word.
    function highlight(word, grapheme) {
        const tiles = tilesFor(word);
        let marked = false;
        const position = L().sounds[grapheme]?.[1];
        return tiles.map((tile, i) => {
            const hit = !marked && tile.toLocaleLowerCase() === grapheme && (position !== "start" || i === 0) && (position !== "end" || i === tiles.length - 1);
            if (hit) marked = true;
            return hit ? `<b>${escape(cased(tile))}</b>` : escape(cased(tile));
        }).join("");
    }
    // Answer buttons: a right tap solves the task, a wrong one is disabled and explained aloud.
    function choices(task, {
        answer,
        kind,
        label,
        right,
        wrong
    }) {
        const cls = {
            letter: "pa-letter-option",
            word: "pa-word-option",
            picture: "pa-card"
        } [kind];
        const markup = `<div class="pa-choices pa-${kind}-options">${task.options.map((option) => {
            const text = kind === "picture" ? imageHtml(pictureOf(option)) : escape(label(option));
            const long = kind === "letter" && label(option).length > 2 ? "pa-long" : "";
            const choice = `<button type="button" class="${cls} ${long}" data-option="${escape(option)}" data-answer="${option === answer}" aria-label="${escape(kind === "picture" ? t("picture", { word: shown(option) }) : kind === "word" ? t("wordChoice", { word: label(option) }) : t("letterChoice", { letter: label(option) }))}">${text}</button>`;
            // Pictures get their own speaker, so a child can hear what a picture is called without choosing it.
            return kind === "picture"
                ? `<div class="pa-option">${choice}<button type="button" class="pa-hear" data-hear="${escape(option)}" aria-label="${escape(t("hearPicture", { word: shown(option) }))}"><span aria-hidden="true"></span></button></div>`
                : choice;
        }).join("")}</div>`;
        const wire = () => {
            stage.querySelectorAll("[data-hear]").forEach((button) => {
                button.onclick = () => {
                    pulse(button);
                    say(`w:${wordKey(button.dataset.hear)}`);
                };
            });
            stage.querySelectorAll("[data-option]").forEach(wireOption);
        };
        const wireOption = (button) => {
            button.onclick = () => {
                if (round.busy || button.disabled) return;
                if (button.dataset.option === answer) {
                    stage.querySelectorAll("[data-option]").forEach((item) => {
                        item.disabled = true;
                    });
                    success(task, button, right(button));
                } else {
                    button.disabled = true;
                    if (kind === "picture") button.insertAdjacentHTML("beforeend", `<span class="pa-card-word">${escape(cased(shown(button.dataset.option)))}</span>`);
                    mistake(task, button, wrong ? wrong(button.dataset.option) : [kind === "letter" ? `ph:${button.dataset.option}` : `w:${wordKey(button.dataset.option)}`]);
                }
            };
        };
        return {
            markup,
            wire
        };
    }

    /* Letters path */
    // A new letter is shown and named, then hidden behind a speaker so the child finds it by hearing its name.
    renderers.meet = (task, lead) => {
        const [example] = L().sounds[task.grapheme];
        setGuide(`${t("meet")}: ${letterShown(task.grapheme)}`);
        const options = choices(task, {
            answer: task.grapheme,
            kind: "letter",
            label: (option) => cased(option),
            right: () => {
                showLetter();
                $("meet-picture").insertAdjacentHTML("beforeend", `<span class="pa-card-word">${highlight(example, task.grapheme)}</span>`);
                return [`ph:${task.grapheme}`];
            }
        });
        stage.innerHTML = `<div class="pa-meet">
            <button type="button" class="pa-big-letter" id="meet-letter" aria-label="${escape(t("listen"))}: ${escape(letterShown(task.grapheme))}">${escape(letterShown(task.grapheme, true))}</button>
            <button type="button" class="pa-card pa-card-large" id="meet-picture" aria-label="${escape(t("hearPicture", { word: shown(example) }))}">${imageHtml(pictureOf(example))}</button>
        </div>${options.markup}`;
        const letter = $("meet-letter");
        const showLetter = () => {
            letter.classList.remove("pa-listen-card");
            letter.textContent = letterShown(task.grapheme, true);
        };
        const ask = () => say(["line:findIt", `ph:${task.grapheme}`]);
        const hideLetter = () => {
            if (!round || round.tasks[round.step] !== task || letter.dataset.hidden) return;
            letter.dataset.hidden = "1";
            if (state.sound) {
                letter.classList.add("pa-listen-card");
                letter.innerHTML = '<span aria-hidden="true"></span>';
                letter.setAttribute("aria-label", t("listen"));
            }
            stage.querySelectorAll("[data-option]").forEach((button) => {
                button.disabled = false;
            });
            round.replay = ask;
        };
        round.replay = () => say([`in:${task.grapheme}`]);
        letter.onclick = () => {
            pulse(letter);
            say(`ph:${task.grapheme}`);
        };
        $("meet-picture").onclick = () => say(`w:${wordKey(example)}`);
        options.wire();
        // With sound off there is nothing to listen for, so the letter stays visible and the choices open at once.
        if (!state.sound) return hideLetter();
        stage.querySelectorAll("[data-option]").forEach((button) => {
            button.disabled = true;
        });
        // Whatever the sound does, the choices never stay locked for long.
        const unlock = setTimeout(hideLetter, 7000);
        (async () => {
            const heard = await say([lead, `in:${task.grapheme}`]);
            clearTimeout(unlock);
            hideLetter();
            if (heard) ask();
        })();
    };
    renderers.matchCase = (task, lead) => {
        setGuide(L().lines.smallQ);
        // Arabic has no capitals: the letter is matched to its joined shape (ب to ـبـ) instead.
        const shape = (option) => (L().caseless ? `\u0640${option}\u0640` : option);
        const options = choices(task, {
            answer: task.grapheme,
            kind: "letter",
            label: shape,
            right: () => [`ph:${task.grapheme}`]
        });
        stage.innerHTML = `${bigLetter(task.grapheme.toLocaleUpperCase(), false)}${options.markup}`;
        round.replay = () => say(["line:smallQ", `ph:${task.grapheme}`]);
        $("prompt-sound").onclick = () => {
            pulse($("prompt-sound"));
            say(`ph:${task.grapheme}`);
        };
        options.wire();
        say([lead, "line:smallQ", `ph:${task.grapheme}`]);
    };
    renderers.pickLetter = (task, lead) => {
        setGuide(lineText(questionLine(task)));
        const options = choices(task, {
            answer: task.grapheme,
            kind: "letter",
            label: (option) => cased(option),
            right: () => [`ph:${task.grapheme}`, `w:${wordKey(task.word)}`]
        });
        stage.innerHTML = `${pictureButton(task.word)}${options.markup}`;
        round.replay = () => say([`w:${wordKey(task.word)}`, questionLine(task)]);
        $("prompt-picture").onclick = () => say(`w:${wordKey(task.word)}`);
        options.wire();
        say([lead, `w:${wordKey(task.word)}`, questionLine(task)]);
    };
    renderers.pickPicture = (task, lead) => {
        setGuide(lineText(questionLine(task)));
        const options = choices(task, {
            answer: task.word,
            kind: "picture",
            right: (button) => {
                button.insertAdjacentHTML("beforeend", `<span class="pa-card-word">${highlight(task.word, task.grapheme)}</span>`);
                return [`w:${wordKey(task.word)}`];
            }
        });
        stage.innerHTML = `${bigLetter(letterShown(task.grapheme))}${options.markup}`;
        round.replay = () => say([questionLine(task), `ph:${task.grapheme}`]);
        $("prompt-sound").onclick = () => {
            pulse($("prompt-sound"));
            say(`ph:${task.grapheme}`);
        };
        options.wire();
        say([lead, questionLine(task), `ph:${task.grapheme}`]);
    };
    renderers.hunt = (task, lead) => {
        setGuide(L().lines.huntQ);
        stage.innerHTML = `${listenCard(letterShown(task.grapheme))}
            <div class="pa-hunt">${task.cells.map((cell, i) => `<button type="button" class="pa-hunt-cell ${cell.length > 2 ? "pa-long" : ""}" data-cell="${i}" data-answer="${cell === task.grapheme}" aria-label="${escape(t("letterChoice", { letter: cased(cell) }))}">${escape(cased(cell))}</button>`).join("")}</div>`;
        round.replay = () => say(["line:huntQ", `ph:${task.grapheme}`]);
        $("prompt-sound").onclick = () => {
            pulse($("prompt-sound"));
            say(`ph:${task.grapheme}`);
        };
        stage.querySelectorAll("[data-cell]").forEach((button) => {
            button.onclick = () => {
                if (round.busy || button.disabled) return;
                button.disabled = true;
                if (button.dataset.answer !== "true") {
                    mistake(task, button, [`ph:${task.cells[Number(button.dataset.cell)]}`]);
                    return;
                }
                button.classList.add("is-right");
                if (stage.querySelector("[data-answer='true']:not(:disabled)")) say(`ph:${task.grapheme}`);
                else success(task, button, [`ph:${task.grapheme}`]);
            };
        });
        say([lead, "line:huntQ", `ph:${task.grapheme}`]);
    };

    /* Words path */
    // Slots filled from a bank of pieces; used for letters in words and for words in sentences.
    function slotPuzzle(task, {
        target,
        pieces,
        sound,
        finish,
        typing = false
    }) {
        const activeRound = round;
        const isCurrent = () => round === activeRound && round?.tasks[round.step] === task;
        const slots = Array(target.length).fill(null);
        const textOf = (id) => pieces.find((piece) => piece.id === id).text;
        // Compare what the child sees: in capitals mode "M" and "m" are the same tile.
        const same = (a, b) => cased(a) === cased(b);
        stage.insertAdjacentHTML("beforeend", `<div class="pa-slots ${typing ? "" : "pa-slots-words"}" id="slots" data-target="${escape(target.map((text) => cased(text)).join("|"))}"></div>
            <div class="pa-bank ${typing ? "" : "pa-bank-words"}" id="bank">${pieces.map((piece) => `<button type="button" class="pa-tile" data-tile="${piece.id}" aria-label="${escape(t("tile", { letter: cased(piece.text) }))}">${escape(cased(piece.text))}</button>`).join("")}</div>`);
        const sync = () => {
            $("slots").innerHTML = slots.map((id, i) => `<button type="button" class="pa-slot ${id === null ? "" : "is-filled"}" data-slot="${i}" ${id === null ? "disabled" : ""} aria-label="${escape(id === null ? t("emptySlot", { n: i + 1 }) : t("slot", { n: i + 1, letter: cased(textOf(id)) }))}">${id === null ? "" : escape(cased(textOf(id)))}</button>`).join("");
            $("slots").querySelectorAll("[data-slot]").forEach((button) => {
                button.onclick = () => {
                    if (!isCurrent() || round.busy) return;
                    slots[Number(button.dataset.slot)] = null;
                    sync();
                };
            });
            stage.querySelectorAll("[data-tile]").forEach((button) => {
                button.disabled = slots.includes(Number(button.dataset.tile));
                button.classList.remove("is-hint");
            });
            // After two misses the next correct piece glows.
            if (round.taskMistakes >= 2) {
                const gap = slots.findIndex((id, i) => id === null || !same(textOf(id), target[i]));
                const wanted = gap < 0 ? null : pieces.find((piece) => same(piece.text, target[gap]) && !slots.includes(piece.id));
                if (wanted) stage.querySelector(`[data-tile="${wanted.id}"]`).classList.add("is-hint");
            }
        };
        const check = async () => {
            if (!isCurrent() || round.busy || slots.includes(null)) return;
            // A completed answer is checked atomically, before another tap or key can change it.
            round.busy = true;
            stage.querySelectorAll("[data-slot], [data-tile]").forEach((button) => {
                button.disabled = true;
            });
            const built = slots.map(textOf);
            if (built.every((text, i) => same(text, target[i]))) {
                $("slots").querySelectorAll(".pa-slot").forEach((slot) => slot.classList.add("is-right"));
                // In a joined script the separate letters become one word once it is built.
                if (typing && L().connected) $("slots").insertAdjacentHTML("afterend", `<p class="pa-joined-word">${escape(target.join(""))}</p>`);
                success(task, $("slots"), finish);
            } else {
                $("slots").querySelectorAll(".pa-slot").forEach((slot, i) => slot.classList.toggle("is-wrong", !same(built[i], target[i])));
                await sleep(800);
                if (!isCurrent()) return;
                built.forEach((text, i) => {
                    if (!same(text, target[i])) slots[i] = null;
                });
                round.busy = false;
                mistake(task, null, []);
                sync();
            }
        };
        const add = (id) => {
            if (!isCurrent() || round.busy || slots.includes(id)) return;
            const free = slots.indexOf(null);
            if (free < 0) return;
            slots[free] = id;
            sync();
            if (!slots.includes(null)) check();
            else say(sound(textOf(id)));
        };
        stage.querySelectorAll("[data-tile]").forEach((button) => {
            button.onclick = () => add(Number(button.dataset.tile));
        });
        if (typing) {
            round.keyboard = (key) => {
                if (!isCurrent() || round.busy) return;
                const free = pieces.filter((piece) => !slots.includes(piece.id));
                const match = free.find((piece) => piece.text.toLocaleLowerCase() === key) || free.find((piece) => piece.text.toLocaleLowerCase().startsWith(key));
                if (key === "backspace") {
                    const last = slots.findLastIndex((id) => id !== null);
                    if (last >= 0) {
                        slots[last] = null;
                        sync();
                    }
                } else if (match) add(match.id);
            };
        }
        sync();
    }
    renderers.build = (task, lead) => {
        setGuide(L().lines.build);
        stage.innerHTML = pictureButton(task.word);
        round.replay = () => say(["line:build", `w:${wordKey(task.word)}`]);
        $("prompt-picture").onclick = () => say(`w:${wordKey(task.word)}`);
        slotPuzzle(task, {
            target: task.tiles,
            pieces: task.bank,
            typing: true,
            sound: (text) => `ph:${text.toLocaleLowerCase()}`,
            finish: [...task.tiles.map((tile) => `ph:${tile.toLocaleLowerCase()}`), `w:${wordKey(task.word)}`]
        });
        say([lead, "line:build", `w:${wordKey(task.word)}`]);
    };
    renderers.missing = (task, lead) => {
        setGuide(L().lines.missingQ);
        const options = choices(task, {
            answer: task.grapheme,
            kind: "letter",
            label: (option) => cased(option),
            right: () => {
                $("missing-slot").textContent = cased(task.tiles[task.gap]);
                $("missing-slot").classList.add("is-right");
                return [`ph:${task.grapheme}`, `w:${wordKey(task.word)}`];
            }
        });
        stage.innerHTML = `${pictureButton(task.word)}<div class="pa-read-word">${task.tiles.map((tile, i) => i === task.gap
            ? `<span class="pa-read-tile pa-gap" id="missing-slot" aria-label="${escape(t("emptySlot", { n: i + 1 }))}"></span>`
            : `<span class="pa-read-tile">${escape(cased(tile))}</span>`).join("")}</div>${options.markup}`;
        round.replay = () => say(["line:missingQ", `w:${wordKey(task.word)}`]);
        $("prompt-picture").onclick = () => say(`w:${wordKey(task.word)}`);
        options.wire();
        say([lead, "line:missingQ", `w:${wordKey(task.word)}`]);
    };
    renderers.read = (task, lead) => {
        setGuide(L().lines.read);
        const options = choices(task, {
            answer: task.word,
            kind: "picture",
            right: () => [`w:${wordKey(task.word)}`]
        });
        // Joined scripts are read as one word, the way children will meet them in books.
        const word = L().connected ?
            `<span class="pa-read-tile pa-joined">${escape(task.word)}</span>` :
            task.tiles.map((tile) => `<button type="button" class="pa-read-tile" data-sound="${escape(tile.toLocaleLowerCase())}" aria-label="${escape(t("listen"))}: ${escape(cased(tile))}">${escape(cased(tile))}</button>`).join("");
        stage.innerHTML = `<div class="pa-read-word">${word}</div>${options.markup}`;
        round.replay = () => say("line:read");
        stage.querySelectorAll("[data-sound]").forEach((button) => {
            button.onclick = () => {
                pulse(button);
                say(`ph:${button.dataset.sound}`);
            };
        });
        options.wire();
        say([lead, "line:read"]);
    };
    renderers.match = (task, lead) => {
        setGuide(L().lines.matchQ);
        const options = choices(task, {
            answer: task.word,
            kind: "word",
            label: (option) => cased(shown(option)),
            right: () => [`w:${wordKey(task.word)}`]
        });
        stage.innerHTML = `${pictureButton(task.word)}${options.markup}`;
        round.replay = () => say(["line:matchQ", `w:${wordKey(task.word)}`]);
        $("prompt-picture").onclick = () => say(`w:${wordKey(task.word)}`);
        options.wire();
        say([lead, "line:matchQ", `w:${wordKey(task.word)}`]);
    };

    /* Stories path */
    // A sentence of tappable words; a gap keeps the punctuation that followed the missing word.
    function sentenceHtml(tokens, {
        gapAt = -1
    } = {}) {
        return `<p class="pa-sentence" id="sentence">${tokens.map((token, i) => i === gapAt
            ? `<span class="pa-word pa-gap" id="gap" aria-label="${escape(t("gap"))}"></span>${escape(token.replace(/^[\p{L}']+/u, ""))}`
            : `<button type="button" class="pa-word" data-word="${escape(wordKey(token))}">${escape(cased(token))}</button>`).join(" ")}</p>`;
    }
    // Tapping a word reads it; the returned function reads the whole sentence with each word lighting up.
    function wireWords(clipId) {
        stage.querySelectorAll(".pa-word[data-word]").forEach((button) => {
            button.onclick = () => {
                pulse(button);
                say(`w:${button.dataset.word}`);
            };
        });
        const timings = clipEntry(clipId)?.[2];
        const nodes = [...stage.querySelectorAll("#sentence .pa-word")];
        return async () => {
            const finishedReading = await say(clipId, {
                onTime: (time) => {
                    if (!timings) return;
                    const current = timings.findLastIndex((start) => time >= start - 0.05);
                    nodes.forEach((node, i) => node.classList.toggle("pa-reading", i === current));
                }
            });
            nodes.forEach((node) => node.classList.remove("pa-reading"));
            return finishedReading;
        };
    }
    const readButton = () => `<div class="pa-story-tools"><button type="button" class="pa-read-aloud" id="read-aloud"><span aria-hidden="true"></span>${t("readToMe")}</button></div>`;
    renderers.sentencePic = (task, lead) => {
        setGuide(L().lines.sentencePicQ);
        const options = choices(task, {
            answer: task.answer,
            kind: "picture",
            right: () => [`sn:${task.index}`]
        });
        stage.innerHTML = `${sentenceHtml(task.tokens)}${readButton()}${options.markup}`;
        $("read-aloud").onclick = wireWords(`sn:${task.index}`);
        round.replay = () => say("line:sentencePicQ");
        options.wire();
        say([lead, "line:sentencePicQ"]);
    };
    renderers.cloze = (task, lead) => {
        setGuide(L().lines.clozeQ);
        const options = choices(task, {
            answer: task.answer,
            kind: "word",
            label: (option) => cased(shown(option)),
            right: () => {
                $("gap").textContent = cased(task.tokens[task.answerAt].match(/[\p{L}']+/u)[0]);
                $("gap").classList.add("is-right");
                return [`sn:${task.index}`];
            }
        });
        stage.innerHTML = `<div class="pa-story-pictures"><span class="pa-card pa-card-static">${imageHtml(pictureOf(task.answer))}</span></div>${sentenceHtml(task.tokens, { gapAt: task.answerAt })}${options.markup}`;
        wireWords(`cz:${task.index}`);
        round.replay = () => say(["line:clozeQ", `cz:${task.index}`]);
        options.wire();
        say([lead, "line:clozeQ", `cz:${task.index}`]);
    };
    renderers.order = (task, lead) => {
        setGuide(L().lines.orderQ);
        stage.innerHTML = readButton();
        round.replay = () => say(["line:orderQ", `sn:${task.index}`]);
        $("read-aloud").onclick = () => say(`sn:${task.index}`);
        slotPuzzle(task, {
            target: task.tokens,
            pieces: task.pieces,
            sound: (text) => `w:${wordKey(text)}`,
            finish: [`sn:${task.index}`]
        });
        say([lead, "line:orderQ", `sn:${task.index}`]);
    };
    renderers.question = (task, lead) => {
        const text = L().stories[task.story].questions[task.question].text;
        const id = `q:${task.story}:${task.question}`;
        setGuide(cased(text));
        const options = choices(task, {
            answer: task.answer,
            kind: "picture",
            right: () => [`w:${wordKey(task.answer)}`]
        });
        stage.innerHTML = `<p class="pa-question">${escape(cased(text))}</p>${options.markup}`;
        round.replay = () => say(id);
        options.wire();
        say([lead, task.question === 0 ? "line:questions" : null, id]);
    };
    renderers.story = (task, lead) => {
        const activeRound = round;
        const isCurrent = () => round === activeRound && round?.tasks[round.step] === task;
        const story = L().stories[task.story];
        const page = story.pages[task.page];
        const id = `st:${task.story}:${task.page}`;
        const lastPage = task.page === story.pages.length - 1;
        setGuide(`${story.title} · ${task.page + 1}/${story.pages.length}`);
        stage.innerHTML = `<div class="pa-story-pictures">${page.pics.map((pic) => `<span class="pa-card pa-card-static">${imageHtml(pic)}</span>`).join("")}</div>
            ${sentenceHtml(page.text.split(/\s+/))}${readButton()}
            <div class="pa-actions"><button type="button" class="pa-next" id="story-next">${t(lastPage ? "storyQuestions" : "nextPage")}</button></div>`;
        const readAloud = wireWords(id);
        round.replay = readAloud;
        $("read-aloud").onclick = readAloud;
        // Reading a page is practice; the following questions check what happened in the story.
        $("story-next").onclick = () => {
            if (!isCurrent() || round.busy) return;
            round.busy = true;
            stopAudio();
            round.step += 1;
            showTask(lastPage ? "line:theEnd" : null);
        };
        (async () => {
            if (lead && !(await say(lead))) return;
            if (isCurrent()) readAloud();
        })();
    };

    function finishRound() {
        const {
            index,
            path
        } = round;
        const stars = round.mistakes <= 1 ? 3 : round.mistakes <= 3 ? 2 : 1;
        const first = done(path)[index] === undefined;
        done(path)[index] = Math.max(done(path)[index] || 0, stars);
        save();
        const all = levels(path).every((_, i) => done(path)[i] !== undefined);
        updateProgress();
        setGuide(t("levelDone"));
        stage.className = "pa-stage pa-task-reward";
        stage.innerHTML = `<div class="pa-reward">
            <h2>${all && first ? t("allDone") : t("levelDone")}</h2>
            ${starsHtml(stars, "pa-stars-big")}
            ${first ? `<div class="pa-reward-sticker"><span class="pa-sticker is-won is-new">${imageHtml(stickerOf(path, index))}</span><p>${t("newSticker")}</p></div>` : ""}
            <div class="pa-actions">
                ${index < levels(path).length - 1 ? `<button type="button" class="pa-next" id="reward-next">${t("nextLevel")}</button>` : ""}
                <button type="button" class="pa-secondary" id="reward-again">${t("playAgainLevel")}</button>
                ${first ? `<button type="button" class="pa-secondary" id="reward-stickers">${t("stickerTitle")}</button>` : ""}
                <button type="button" class="pa-secondary" id="reward-map">${t("backToMap")}</button>
            </div></div>`;
        stopAudio();
        tone("fanfare");
        if (!reducedMotion()) stage.querySelectorAll(".pa-stars-big i.is-on").forEach((star, i) => {
            star.style.animationDelay = `${0.25 + i * 0.3}s`;
        });
        burst(stage.querySelector(".pa-reward h2"));
        round.replay = null;
        $("reward-next")?.addEventListener("click", () => startLevel(index + 1, path));
        $("reward-again").onclick = () => startLevel(index, path);
        $("reward-map").onclick = closePlay;
        $("reward-stickers")?.addEventListener("click", openStickers);
        renderStickers();
        ($("reward-next") || $("reward-map")).focus({
            preventScroll: true
        });
        // Let the fanfare end before the voice starts.
        const reward = round;
        sleep(state.sound ? 1100 : 0).then(() => {
            if (round === reward && round.step >= round.tasks.length) say([all && first ? "line:allDone" : "line:levelDone", first ? "line:sticker" : null]);
        });
    }

    /* ---------- Page wiring ---------- */
    function translate() {
        app.lang = state.language;
        document.documentElement.lang = state.language;
        app.dir = L().rtl ? "rtl" : "ltr";
        app.querySelectorAll("[data-i18n]").forEach((node) => {
            node.textContent = t(node.dataset.i18n);
        });
        app.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === state.language)));
        $("path-tabs").setAttribute("aria-label", t("choosePath"));
        $("close-stickers").setAttribute("aria-label", t("closeStickers"));
        $("sound-toggle").setAttribute("aria-pressed", String(state.sound));
        $("sound-label").textContent = t(state.sound ? "soundOn" : "soundOff");
        $("slow-voice").checked = state.slow;
        $("unlock-all").checked = state.unlockAll;
        $("auto-fullscreen").checked = state.fullscreen;
        $("auto-fullscreen").closest("label").hidden = !canFullscreen;
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
    app.querySelectorAll("[data-open-stickers]").forEach((button) => {
        button.onclick = openStickers;
    });
    $("close-stickers").onclick = closeStickers;
    $("replay").onclick = () => {
        if (round?.replay) round.replay();
    };
    $("slow-voice").onchange = (event) => {
        state.slow = event.target.checked;
        save();
    };
    $("unlock-all").onchange = (event) => {
        state.unlockAll = event.target.checked;
        save();
        renderMap();
    };
    $("auto-fullscreen").onchange = (event) => {
        state.fullscreen = event.target.checked;
        save();
    };
    $("fullscreen-toggle").onclick = () => (fullscreenElement() ? exitFullscreen() : enterFullscreen());
    $("reset-progress").onclick = () => {
        if (!window.confirm(t("resetConfirm"))) return;
        state.journeys[state.language] = freshJourney();
        save();
        renderMap();
    };
    document.addEventListener("keydown", (event) => {
        if (!dialog.hidden) {
            if (event.key === "Escape") {
                event.preventDefault();
                closeStickers();
            }
            return;
        }
        if (!round) return;
        if (event.key === "Escape") {
            event.preventDefault();
            closePlay();
            return;
        }
        if (!round.keyboard || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === "Backspace") {
            event.preventDefault();
            round.keyboard("backspace");
        } else if (event.key.length === 1 && /\p{L}/u.test(event.key)) {
            event.preventDefault();
            round.keyboard(event.key.toLocaleLowerCase());
        }
    });
    // Keep focus inside the round, or the sticker book, while it is open.
    const trapFocus = (container) => (event) => {
        if (event.key !== "Tab") return;
        const items = [...container.querySelectorAll("button:not(:disabled)")].filter((node) => node.offsetParent !== null);
        if (!items.length) return;
        const [first, last] = [items[0], items[items.length - 1]];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    dialog.addEventListener("keydown", trapFocus(dialog));
    play.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;
        const items = [...play.querySelectorAll("button:not(:disabled)")].filter((node) => node.offsetParent !== null);
        if (!items.length) return;
        const [first, last] = [items[0], items[items.length - 1]];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopAudio();
    });
    if (!window.PhonicsAudio) $("audio-note").textContent = t("audioMissing");
    translate();
    save();
});