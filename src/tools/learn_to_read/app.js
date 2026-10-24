document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const content = window.PhonicsContent;
    const KEY = "phonicsAdventure.v2";
    const MODES = ["sounds", "words", "stories"];
    const $ = (id) => document.getElementById(id);
    const app = $("phonics-app");
    const area = $("activity-area");
    const feedback = $("feedback");
    const next = $("next-activity");
    const letters = () => content.letters[state.language];
    const groups = () => content.words[state.language];
    const stories = () => content.stories[state.language];
    const journey = () => state.journeys[state.language];
    const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    const normalize = (value) => value.toLocaleLowerCase(state.language).replace(/[^\p{L}]/gu, "");
    const shuffle = (items) => [...items].map((value) => ({ value, sort: Math.random() })).sort((a, b) => a.sort - b.sort).map(({ value }) => value);
    const dateKey = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    };

    const strings = {
        en: {
            eyebrow: "LITTLE SOUNDS. BIG ADVENTURES.", title: "Phonics Adventure",
            intro: "A little listening. A little reading. A whole world to discover.",
            guideName: "FINN THE FOX", welcome: "Every great reader starts with a little curiosity. Let’s go!",
            sounds: "Letter Meadow", soundsSub: "Listen & discover", words: "Word Workshop", wordsSub: "Build & blend", stories: "Story Woods", storiesSub: "Read & explore",
            audioOn: "Sound on", audioOff: "Sound off", audioUnavailable: "Read together", focus: "Focus view", exitFocus: "Exit focus view",
            dailyTitle: "A little every day", dailyHint: "Collect 5 stars on today’s trail.", dailyCount: "{n} of 5 discoveries", goalDone: "Today’s trail is complete. Beautiful work!",
            journey: "Your story so far", saved: "Your progress is saved on this device.", saveFail: "Progress could not be saved. You can still play.",
            gentleNote: "No timers. No rush. Just one lovely discovery at a time.",
            grownups: "A little help for grown-ups", togetherTitle: "Small steps, together.",
            togetherText: "Try a few minutes at a time. Say the sounds together, then blend them into a word. Explore any area whenever your child is ready. Storybooks include words you may need to read together.",
            speechNote: "The Listen buttons use your device’s reading voice for whole words and sentences. For individual letter sounds, model the sound yourself without adding “uh”.",
            practiceTitle: "Practice at a glance", voiceSpeed: "Reading voice speed", slow: "Gentle", normal: "Natural",
            languageNote: "English and German each have their own learning journey.", reset: "Reset this language’s progress",
            resetConfirm: "Reset all English progress? This cannot be undone. German progress will be kept.",
            available: "Reading voices depend on your browser and installed languages.", unavailable: "A reading voice is unavailable here. Use the visible clues and read together with a grown-up.", audioError: "The reading voice could not play. Read the visible clue together or try Listen again.",
            soundsLabel: "01 / LETTER MEADOW", wordsLabel: "02 / WORD WORKSHOP", storiesLabel: "03 / STORY WOODS",
            soundTitle: "A little letter discovery", soundHint: "Listen to the word. Which letter does it start with?", endHint: "Listen to fox. Which letter is at the end?",
            soundPrompt: "{word}. Which letter does {word} start with?", endPrompt: "Fox. Which letter is at the end of fox?",
            listen: "Listen", listenAgain: "Listen again", slower: "A little slower", letterHint: "Tap a letter to make your match.",
            correctLetter: "Yes! {letter} is for {word}.", correctEnd: "Yes! Fox ends with x.", wrongLetter: "A good try. Look at the word and try another letter.",
            next: "Next adventure →", anotherLetter: "Next letter →", skip: "Try another →", pickLetter: "Explore the letter meadow", chooseLetter: "Explore letter {letter}", letterCount: "{n} of {total} letters discovered",
            wordTitle: "Let’s build a little word", buildHint: "Listen, then tap the tiles in order. Tap a box to take a tile back.",
            showWord: "Show the word", hideWord: "Hide the word", wordClue: "Word clue", check: "Check my word", undo: "Undo", clear: "Start again", slot: "Box {n}: {letter}. Tap to remove.", emptySlot: "Empty box {n}",
            wrongWord: "Almost! Listen again, or show the word. You can change any tile.", correctWord: "You built {word}. Wonderful work!", nextWord: "Next word →", keyboardTip: "You can also type letters, use Backspace, and press Enter to check.", tile: "Add {letter}", wordSet: "Choose a word trail", trailCount: "{n} of {total} words discovered", soundTeam: "Letters joined on a tile work as a team.",
            storyTitle: "A small story, a big adventure", chooseStory: "Choose a story", page: "Page {n} of {total}", readTogether: "Read with me", stop: "Stop reading", findWord: "Find the word", storyHint: "Tap the word in the sentence above.", storyListen: "Find the word {word}.",
            wrongStory: "Try another word. Match the letters in the little clue.", correctStory: "You found {word}. Lovely reading!", nextPage: "Next page →", nextBook: "Another story →", storyDone: "You finished {title}!", previousPage: "← Previous page", storyTip: "Read together, then find one word on each page.",
            statLetters: "Letters", statWords: "Words", statStories: "Stories", discovered: "discovered", read: "read", attempts: "Checks", correct: "Right", lettersRow: "Letters", wordsRow: "Words", storiesRow: "Story words",
            badgeFirst: "First discovery", badgeLetters: "10 letters", badgeWords: "5 words", badgeStory: "Story explorer", badgeGoal: "Daily trail", badgeLocked: "Still to discover", badgeEarned: "Earned", progressLabel: "Daily adventure progress", languageLabel: "Learning language", pathLabel: "Reading adventures", sidebarLabel: "Your reading journey", legacy: "Your earlier progress has come along for the adventure.", resetDone: "A fresh adventure is ready.", mastered: "Already discovered", newDiscovery: "Ready to discover", speechPlaying: "Reading…"
        },
        de: {
            eyebrow: "KLEINE LAUTE. GROSSE ABENTEUER.", title: "Lese-Abenteuer",
            intro: "Ein bisschen hören. Ein bisschen lesen. Eine ganze Welt entdecken.",
            guideName: "FINN DER FUCHS", welcome: "Jedes Lese-Abenteuer beginnt mit ein wenig Neugier. Los geht’s!",
            sounds: "Buchstabenwiese", soundsSub: "Hören & entdecken", words: "Wörterwerkstatt", wordsSub: "Bauen & verbinden", stories: "Geschichtenwald", storiesSub: "Lesen & entdecken",
            audioOn: "Ton an", audioOff: "Ton aus", audioUnavailable: "Zusammen lesen", focus: "Fokusansicht", exitFocus: "Fokus beenden",
            dailyTitle: "Jeden Tag ein bisschen", dailyHint: "Sammle heute 5 Sterne auf deinem Pfad.", dailyCount: "{n} von 5 Entdeckungen", goalDone: "Dein Tagespfad ist geschafft. Toll gemacht!",
            journey: "Dein bisheriger Weg", saved: "Dein Fortschritt wird auf diesem Gerät gespeichert.", saveFail: "Der Fortschritt konnte nicht gespeichert werden. Du kannst weiterspielen.",
            gentleNote: "Keine Zeitvorgaben. Keine Eile. Eine schöne Entdeckung nach der anderen.",
            grownups: "Eine kleine Hilfe für Erwachsene", togetherTitle: "Kleine Schritte, gemeinsam.",
            togetherText: "Übt jeweils ein paar Minuten. Sprecht die Laute zusammen und verbindet sie zu einem Wort. Entdeckt jeden Bereich, sobald euer Kind bereit ist. In den Geschichten gibt es auch Wörter, die ihr gemeinsam lesen könnt.",
            speechNote: "Die Hören-Tasten nutzen die Vorlesestimme deines Geräts für ganze Wörter und Sätze. Einzelne Buchstabenlaute sprichst du am besten selbst vor, ohne ein zusätzliches „uh“.",
            practiceTitle: "Übung auf einen Blick", voiceSpeed: "Tempo der Vorlesestimme", slow: "Gemütlich", normal: "Natürlich",
            languageNote: "Deutsch und Englisch haben jeweils ihren eigenen Lernfortschritt.", reset: "Fortschritt für Deutsch zurücksetzen",
            resetConfirm: "Den gesamten deutschen Fortschritt zurücksetzen? Das lässt sich nicht rückgängig machen. Der englische Fortschritt bleibt erhalten.",
            available: "Vorlesestimmen hängen vom Browser und den installierten Sprachen ab.", unavailable: "Hier ist keine Vorlesestimme verfügbar. Nutzt die sichtbaren Hinweise und lest mit einem Erwachsenen.", audioError: "Die Vorlesestimme konnte nicht starten. Lest den Hinweis zusammen oder tippt noch einmal auf Hören.",
            soundsLabel: "01 / BUCHSTABENWIESE", wordsLabel: "02 / WÖRTERWERKSTATT", storiesLabel: "03 / GESCHICHTENWALD",
            soundTitle: "Eine kleine Buchstabenentdeckung", soundHint: "Höre das Wort. Mit welchem Buchstaben beginnt es?", endHint: "Höre das Wort. Mit welchem Buchstaben beginnt es?",
            soundPrompt: "{word}. Mit welchem Buchstaben beginnt {word}?", endPrompt: "{word}. Mit welchem Buchstaben beginnt {word}?",
            listen: "Hören", listenAgain: "Noch einmal hören", slower: "Etwas langsamer", letterHint: "Tippe auf den passenden Buchstaben.",
            correctLetter: "Ja! {letter} wie {word}.", correctEnd: "Ja!", wrongLetter: "Ein guter Versuch. Schau dir das Wort an und probiere einen anderen Buchstaben.",
            next: "Nächstes Abenteuer →", anotherLetter: "Nächster Buchstabe →", skip: "Etwas anderes →", pickLetter: "Entdecke die Buchstabenwiese", chooseLetter: "Buchstabe {letter} entdecken", letterCount: "{n} von {total} Buchstaben entdeckt",
            wordTitle: "Wir bauen ein kleines Wort", buildHint: "Höre zu und tippe die Bausteine der Reihe nach an. Tippe auf ein Kästchen, um einen Baustein zurückzulegen.",
            showWord: "Wort zeigen", hideWord: "Wort verbergen", wordClue: "Worthinweis", check: "Mein Wort prüfen", undo: "Zurück", clear: "Neu anfangen", slot: "Kästchen {n}: {letter}. Zum Entfernen tippen.", emptySlot: "Leeres Kästchen {n}",
            wrongWord: "Fast! Höre noch einmal oder lass dir das Wort zeigen. Du kannst jeden Baustein ändern.", correctWord: "Du hast {word} gebaut. Toll gemacht!", nextWord: "Nächstes Wort →", keyboardTip: "Du kannst auch Buchstaben tippen, die Rücktaste nutzen und mit Enter prüfen.", tile: "{letter} einsetzen", wordSet: "Wörterpfad auswählen", trailCount: "{n} von {total} Wörtern entdeckt", soundTeam: "Buchstaben auf einem Baustein gehören als Team zusammen.",
            storyTitle: "Eine kleine Geschichte wartet", chooseStory: "Geschichte auswählen", page: "Seite {n} von {total}", readTogether: "Lies mit mir", stop: "Vorlesen stoppen", findWord: "Finde das Wort", storyHint: "Tippe auf das Wort im Satz oben.", storyListen: "Finde das Wort {word}.",
            wrongStory: "Probiere ein anderes Wort. Vergleiche die Buchstaben mit dem kleinen Hinweis.", correctStory: "Du hast {word} gefunden. Prima gelesen!", nextPage: "Nächste Seite →", nextBook: "Andere Geschichte →", storyDone: "Du hast {title} fertig gelesen!", previousPage: "← Vorherige Seite", storyTip: "Lest zusammen und findet auf jeder Seite ein Wort.",
            statLetters: "Buchstaben", statWords: "Wörter", statStories: "Geschichten", discovered: "entdeckt", read: "gelesen", attempts: "Versuche", correct: "Richtig", lettersRow: "Buchstaben", wordsRow: "Wörter", storiesRow: "Geschichtenwörter",
            badgeFirst: "Erste Entdeckung", badgeLetters: "10 Buchstaben", badgeWords: "5 Wörter", badgeStory: "Lesefuchs", badgeGoal: "Tagespfad", badgeLocked: "Noch zu entdecken", badgeEarned: "Geschafft", progressLabel: "Fortschritt des Tagespfads", languageLabel: "Lernsprache", pathLabel: "Lese-Abenteuer", sidebarLabel: "Dein Leseweg", legacy: "Dein bisheriger Fortschritt kommt mit auf das Abenteuer.", resetDone: "Ein neues Abenteuer wartet.", mastered: "Schon entdeckt", newDiscovery: "Bereit zum Entdecken", speechPlaying: "Wird vorgelesen…"
        }
    };
    function t(key, vars = {}) {
        return (strings[state.language][key] || strings.en[key] || key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
    }
    const emptyStats = () => ({ sounds: { attempts: 0, correct: 0 }, words: { attempts: 0, correct: 0 }, stories: { attempts: 0, correct: 0 } });
    const freshJourney = () => ({ sounds: [], words: [], stories: [], pages: [], stars: 0, stats: emptyStats(), daily: { date: dateKey(), count: 0 }, mode: "sounds", group: "first", selected: { sounds: null, words: null, stories: null } });
    const freshState = () => ({ version: 2, language: "en", audio: true, rate: 0.7, journeys: { en: freshJourney(), de: freshJourney() } });
    const number = (value) => Number.isFinite(value) ? Math.min(1000000, Math.max(0, Math.floor(value))) : 0;
    const list = (value) => Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === "string"))] : [];
    let storageFailed = false;
    let migrated = false;

    function sanitizeJourney(raw, lang) {
        const fresh = freshJourney();
        if (!raw || typeof raw !== "object") return fresh;
        const valid = {
            sounds: content.letters[lang].map(([letter]) => letter),
            words: content.words[lang].flatMap((group) => group.items.map((item) => item.id)),
            stories: content.stories[lang].map((story) => story.id),
            pages: content.stories[lang].flatMap((story) => story.pages.map((_, index) => `${story.id}:${index}`))
        };
        for (const key of Object.keys(valid)) fresh[key] = list(raw[key]).filter((id) => valid[key].includes(id));
        fresh.stars = number(raw.stars);
        for (const mode of MODES) {
            fresh.stats[mode].attempts = number(raw.stats?.[mode]?.attempts);
            fresh.stats[mode].correct = Math.min(fresh.stats[mode].attempts, number(raw.stats?.[mode]?.correct));
            const selected = raw.selected?.[mode];
            fresh.selected[mode] = valid[mode].includes(selected) ? selected : null;
        }
        if (MODES.includes(raw.mode)) fresh.mode = raw.mode;
        if (content.words[lang].some((group) => group.id === raw.group)) fresh.group = raw.group;
        if (raw.daily?.date === dateKey()) fresh.daily.count = Math.min(5, number(raw.daily.count));
        return fresh;
    }
    function load() {
        const fresh = freshState();
        try {
            const saved = JSON.parse(localStorage.getItem(KEY));
            if (saved?.version === 2) {
                if (saved.language === "de") fresh.language = "de";
                fresh.audio = saved.audio !== false;
                fresh.rate = saved.rate === 0.9 ? 0.9 : 0.7;
                for (const lang of ["en", "de"]) fresh.journeys[lang] = sanitizeJourney(saved.journeys?.[lang], lang);
                return fresh;
            }
        } catch { /* Invalid or inaccessible storage must not prevent learning. */ }
        try {
            const old = JSON.parse(localStorage.getItem("learnToReadProgress"));
            if (old && typeof old === "object") {
                const lang = old.language === "de" ? "de" : "en";
                fresh.language = lang;
                const previous = fresh.journeys[lang];
                previous.sounds = list(old.masteredSounds).map((letter) => letter.toLowerCase());
                previous.words = list(old.masteredWords).map((word) => content.words[lang].flatMap((group) => group.items).find((item) => item.text.toLowerCase() === word.toLowerCase())?.id).filter(Boolean);
                const legacyStories = lang === "en" ? ["The Cat 🐱", "The Dog 🐕", "The Sun ☀️", "The Pig 🐷", "The Fox 🦊", "The Hen 🐔", "The Bee 🐝", "The Fish 🐟"] : ["Die Katze 🐱", "Der Hund 🐕", "Die Sonne ☀️", "Das Schwein 🐷", "Der Fuchs 🦊", "Das Huhn 🐔", "Die Biene 🐝", "Der Fisch 🐟"];
                const legacyIds = ["cat", "dog", "sun", "pig", "fox", "hen", "bee", "fish"];
                previous.stories = list(old.completedStories).map((title) => legacyIds[legacyStories.indexOf(title)]).filter(Boolean);
                previous.pages = previous.stories.flatMap((id) => [0, 1, 2].map((page) => `${id}:${page}`));
                previous.stars = number(old.stars);
                for (const mode of MODES) previous.stats[mode] = { attempts: number(old.activityStats?.[mode]?.attempts), correct: number(old.activityStats?.[mode]?.correct) };
                previous.mode = old.currentPhase === "sentences" ? "stories" : old.currentPhase === "words" || old.currentPhase === "blends" ? "words" : "sounds";
                fresh.journeys[lang] = sanitizeJourney(previous, lang);
                migrated = true;
            }
        } catch { /* Keep defaults and retain the original legacy save. */ }
        return fresh;
    }

    let state = load();
    let active = null;
    let selection = [];
    let bank = [];
    let tileBuffer = "";
    let solved = false;
    let clueVisible = false;
    let storyPage = 0;
    let focusMode = false;
    let speechToken = 0;
    let speechTimer = null;
    let speaking = false;
    const speechSupported = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance);

    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(state)); storageFailed = false; }
        catch { storageFailed = true; }
        $("save-note").textContent = t(storageFailed ? "saveFail" : "saved");
    }
    function refreshDay() {
        if (journey().daily.date !== dateKey()) journey().daily = { date: dateKey(), count: 0 };
    }
    function stopSpeech() {
        speechToken += 1;
        clearTimeout(speechTimer);
        if (speechSupported) window.speechSynthesis.cancel();
        speaking = false;
        document.querySelectorAll(".pa-speaking").forEach((element) => element.classList.remove("pa-speaking"));
        syncReadButton();
    }
    function syncReadButton() {
        const button = $("read-story");
        if (button) {
            button.textContent = t(speaking ? "stop" : "readTogether");
            button.setAttribute("aria-pressed", String(speaking));
        }
    }
    function speak(text, { slow = false, track = false } = {}) {
        stopSpeech();
        if (!state.audio || !speechSupported) return;
        const token = speechToken;
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = state.language === "de" ? "de-DE" : "en-US";
        utterance.rate = slow ? 0.5 : state.rate;
        const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(state.language));
        if (voice) utterance.voice = voice;
        const finish = () => {
            if (token !== speechToken) return;
            clearTimeout(speechTimer);
            speaking = false;
            area.querySelectorAll(".pa-speaking").forEach((element) => element.classList.remove("pa-speaking"));
            syncReadButton();
        };
        utterance.onboundary = (event) => {
            if (token !== speechToken || !track) return;
            area.querySelectorAll("[data-char-start]").forEach((element) => {
                const start = Number(element.dataset.charStart);
                element.classList.toggle("pa-speaking", event.charIndex >= start && event.charIndex < start + Number(element.dataset.charLength));
            });
        };
        utterance.onend = finish;
        utterance.onerror = (event) => {
            if (token !== speechToken) return;
            finish();
            if (event.error !== "canceled" && event.error !== "interrupted") {
                $("audio-status").textContent = t("audioError");
                if (!solved) announce(t("audioError"));
            }
        };
        // Some browser voices omit lifecycle events. Never leave the UI stuck reading.
        speaking = true;
        syncReadButton();
        speechTimer = setTimeout(finish, Math.max(10000, text.length * 350));
        window.speechSynthesis.speak(utterance);
    }
    function announce(message, kind = "hint") {
        feedback.className = `pa-feedback pa-${kind}`;
        feedback.textContent = message;
    }
    function clearFeedback() { feedback.className = "pa-feedback"; feedback.textContent = ""; }
    function recordAttempt(correct) {
        refreshDay();
        const stats = journey().stats[journey().mode];
        stats.attempts += 1;
        if (correct) stats.correct += 1;
    }
    function reward(kind, id) {
        if (solved) return;
        solved = true;
        recordAttempt(true);
        if (!journey()[kind].includes(id)) journey()[kind].push(id);
        journey().stars += 1;
        journey().daily.count = Math.min(5, journey().daily.count + 1);
        save();
        updateSummary();
        next.disabled = false;
        next.classList.add("pa-ready");
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            $("activity-panel").classList.remove("pa-celebrate");
            void $("activity-panel").offsetWidth;
            $("activity-panel").classList.add("pa-celebrate");
        }
    }
    function updateSummary() {
        refreshDay();
        const current = journey();
        $("total-stars").textContent = current.stars;
        $("goal-stars").innerHTML = Array.from({ length: 5 }, (_, index) => `<span class="${index < current.daily.count ? "is-collected" : ""}">★</span>`).join("");
        $("daily-progress").value = current.daily.count;
        $("goal-caption").textContent = current.daily.count >= 5 ? t("goalDone") : t("dailyCount", { n: current.daily.count });
        $("guide-message").textContent = t(current.daily.count >= 5 ? "goalDone" : "welcome");
        $("journey-stats").innerHTML = [["statLetters", current.sounds.length, letters().length], ["statWords", current.words.length, groups().reduce((sum, group) => sum + group.items.length, 0)], ["statStories", current.stories.length, stories().length]].map(([label, count, total]) => `<div><span>${t(label)}</span><strong>${count}<small> / ${total}</small></strong><span class="pa-meter" aria-hidden="true"><i style="width:${count / total * 100}%"></i></span></div>`).join("");
        const badges = [["✦", "badgeFirst", current.sounds.length + current.words.length + current.pages.length > 0], ["Aa", "badgeLetters", current.sounds.length >= 10], ["abc", "badgeWords", current.words.length >= 5], ["▤", "badgeStory", current.stories.length > 0], ["★", "badgeGoal", current.daily.count >= 5]];
        $("badge-list").innerHTML = badges.map(([icon, label, earned]) => `<span class="pa-badge ${earned ? "is-earned" : ""}" title="${t(label)}: ${t(earned ? "badgeEarned" : "badgeLocked")}"><span aria-hidden="true">${icon}</span><small>${t(label)}</small><span class="pa-sr">: ${t(earned ? "badgeEarned" : "badgeLocked")}</span></span>`).join("");
        $("practice-stats").innerHTML = `<table><thead><tr><th></th><th scope="col">${t("attempts")}</th><th scope="col">${t("correct")}</th></tr></thead><tbody>${MODES.map((mode) => `<tr><th scope="row">${t({ sounds: "lettersRow", words: "wordsRow", stories: "storiesRow" }[mode])}</th><td>${current.stats[mode].attempts}</td><td>${current.stats[mode].correct}</td></tr>`).join("")}</tbody></table>`;
    }
    function translate() {
        app.lang = state.language;
        app.querySelectorAll("[data-i18n]").forEach((element) => { element.textContent = t(element.dataset.i18n); });
        document.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === state.language)));
        app.querySelector(".pa-language").setAttribute("aria-label", t("languageLabel"));
        app.querySelector(".pa-path").setAttribute("aria-label", t("pathLabel"));
        app.querySelector(".pa-sidebar").setAttribute("aria-label", t("sidebarLabel"));
        $("daily-progress").setAttribute("aria-label", t("progressLabel"));
        $("voice-speed").value = state.rate;
        $("focus-toggle").textContent = t(focusMode ? "exitFocus" : "focus");
        $("audio-status").textContent = t(speechSupported ? "available" : "unavailable");
        updateAudioButton();
        updateSummary();
    }
    function updateAudioButton() {
        const button = $("audio-toggle");
        button.setAttribute("aria-pressed", String(state.audio && speechSupported));
        button.querySelector("span:last-child").textContent = t(!speechSupported ? "audioUnavailable" : state.audio ? "audioOn" : "audioOff");
        if (!speechSupported) button.setAttribute("aria-disabled", "true");
        else button.removeAttribute("aria-disabled");
    }
    function pick(items, completed, last, specific) {
        const getId = (item) => Array.isArray(item) ? item[0] : item.id;
        if (specific) {
            const match = items.find((item) => getId(item) === specific);
            if (match) return match;
        }
        return items.find((item) => !completed.includes(getId(item)) && getId(item) !== last)
            || items.find((item) => getId(item) !== last) || items[0];
    }
    function resetActivity() {
        stopSpeech();
        solved = false;
        clueVisible = false;
        selection = [];
        tileBuffer = "";
        clearFeedback();
        next.classList.remove("pa-ready");
        next.disabled = false;
        const mode = journey().mode;
        document.querySelectorAll("[data-mode]").forEach((button) => {
            const selected = button.dataset.mode === mode;
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        $("activity-panel").setAttribute("aria-labelledby", `tab-${mode}`);
        $("activity-panel").dataset.mode = mode;
        $("activity-label").textContent = t(`${mode}Label`);
    }
    function renderActivity({ specific = null, advancing = false } = {}) {
        resetActivity();
        const mode = journey().mode;
        const last = advancing ? journey().selected[mode] : null;
        const preferred = specific || (advancing ? null : journey().selected[mode]);
        if (mode === "sounds") renderSounds(last, preferred);
        else if (mode === "words") renderWords(last, preferred);
        else renderStory(last, preferred);
        save();
    }
    const listenButton = (id, label = "listen") => `<button type="button" class="pa-button pa-listen" id="${id}" ${!state.audio || !speechSupported ? "disabled" : ""}><span aria-hidden="true">♪</span> ${t(label)}</button>`;

    function renderSounds(last, preferred) {
        active = pick(letters(), journey().sounds, last, preferred);
        const [letter, word, emoji] = active;
        journey().selected.sounds = letter;
        const isEnd = state.language === "en" && letter === "x";
        const choices = shuffle([letter, ...shuffle(letters().filter(([item]) => item !== letter)).slice(0, 2).map(([item]) => item)]);
        area.innerHTML = `<div class="pa-activity-heading"><h2 tabindex="-1" id="activity-title">${t("soundTitle")}</h2><p>${t(isEnd ? "endHint" : "soundHint")}</p></div>
            <div class="pa-letter-scene"><span class="pa-scene-dot pa-dot-one" aria-hidden="true"></span><span class="pa-scene-dot pa-dot-two" aria-hidden="true"></span><span class="pa-example-emoji" aria-hidden="true">${emoji}</span><span class="pa-example-word">${escape(word)}</span>${listenButton("listen-letter")}</div>
            <div class="pa-letter-choices" aria-label="${t("letterHint")}">${choices.map((item) => `<button type="button" class="pa-letter-choice" data-letter="${item}" aria-label="${item}"><span>${item}</span><small aria-hidden="true">${item.toUpperCase()}</small><span class="pa-choice-result" aria-hidden="true"></span></button>`).join("")}</div>
            <details class="pa-letter-library"><summary>${t("pickLetter")} <span>${t("letterCount", { n: journey().sounds.length, total: letters().length })}</span></summary><div class="pa-alphabet">${letters().map(([item]) => `<button type="button" data-explore="${item}" class="${journey().sounds.includes(item) ? "is-discovered" : ""}" aria-label="${t("chooseLetter", { letter: item })}; ${t(journey().sounds.includes(item) ? "mastered" : "newDiscovery")}" ${item === letter ? 'aria-current="true"' : ""}>${item}</button>`).join("")}</div></details>`;
        $("activity-tip").textContent = t("letterHint");
        next.textContent = t("skip");
        $("listen-letter").onclick = () => speak(t(isEnd ? "endPrompt" : "soundPrompt", { word }));
        area.querySelectorAll("[data-letter]").forEach((button) => {
            button.onclick = () => {
                if (solved || button.disabled) return;
                if (button.dataset.letter === letter) {
                    button.classList.add("is-correct");
                    button.querySelector(".pa-choice-result").textContent = "✓";
                    reward("sounds", letter);
                    area.querySelectorAll("[data-letter]").forEach((choice) => { choice.disabled = true; });
                    announce(t(isEnd ? "correctEnd" : "correctLetter", { letter, word }), "success");
                    next.textContent = t("anotherLetter");
                } else {
                    recordAttempt(false);
                    button.classList.add("is-wrong");
                    button.querySelector(".pa-choice-result").textContent = "↻";
                    button.disabled = true;
                    announce(t("wrongLetter"), "retry");
                    save();
                    updateSummary();
                }
            };
        });
        area.querySelectorAll("[data-explore]").forEach((button) => { button.onclick = () => { renderActivity({ specific: button.dataset.explore }); focusTitle(); }; });
    }
    function renderWords(last, preferred) {
        const group = groups().find((item) => item.id === journey().group) || groups()[0];
        active = pick(group.items, journey().words, last, preferred);
        journey().selected.words = active.id;
        bank = shuffle(active.tiles.map((tile, id) => ({ text: tile.toLowerCase(), id })));
        selection = Array(active.tiles.length).fill(null);
        area.innerHTML = `<div class="pa-trail-picker"><label for="word-trail" class="pa-sr">${t("wordSet")}</label><select id="word-trail">${groups().map((item) => `<option value="${item.id}" ${item.id === group.id ? "selected" : ""}>${item.title}</option>`).join("")}</select><span>${t("trailCount", { n: group.items.filter((item) => journey().words.includes(item.id)).length, total: group.items.length })}</span></div>
            <div class="pa-activity-heading"><h2 tabindex="-1" id="activity-title">${t("wordTitle")}</h2><p>${t("buildHint")}</p></div>
            <div class="pa-word-clue"><span aria-hidden="true">${active.emoji}</span><div class="pa-listen-row">${listenButton("listen-word")}${listenButton("listen-slow", "slower")}</div><button type="button" id="show-word" class="pa-text-button" aria-expanded="false" aria-controls="word-model">${t("showWord")}</button><p id="word-model" class="pa-word-model" hidden>${escape(active.text)}</p></div>
            <div class="pa-word-slots" id="word-slots" role="group" aria-label="${t("wordTitle")}"></div>
            <div class="pa-letter-bank" id="letter-bank" role="group" aria-label="${t("buildHint")}">${bank.map((tile) => `<button type="button" class="pa-tile" data-tile="${tile.id}" aria-label="${t("tile", { letter: tile.text })}">${tile.text}</button>`).join("")}</div>
            <div class="pa-builder-actions"><button type="button" class="pa-text-button" id="undo-letter">↶ ${t("undo")}</button><button type="button" class="pa-button pa-primary" id="check-word" disabled>${t("check")}</button><button type="button" class="pa-text-button" id="clear-word">${t("clear")}</button></div><p class="pa-trail-hint">${group.hint}${group.id === "teams" ? ` ${t("soundTeam")}` : ""}</p>`;
        next.textContent = t("skip");
        $("activity-tip").textContent = t("keyboardTip");
        $("word-trail").onchange = (event) => { journey().group = event.target.value; journey().selected.words = null; renderActivity(); };
        $("listen-word").onclick = () => speak(active.text);
        $("listen-slow").onclick = () => speak(active.text, { slow: true });
        $("show-word").onclick = () => {
            clueVisible = !clueVisible;
            $("word-model").hidden = !clueVisible;
            $("show-word").textContent = t(clueVisible ? "hideWord" : "showWord");
            $("show-word").setAttribute("aria-expanded", String(clueVisible));
        };
        area.querySelectorAll("[data-tile]").forEach((button) => { button.onclick = () => addTile(Number(button.dataset.tile)); });
        $("undo-letter").onclick = undoTile;
        $("clear-word").onclick = () => { if (!solved) { selection.fill(null); clearFeedback(); syncBuilder(); } };
        $("check-word").onclick = checkWord;
        syncBuilder();
    }
    function addTile(id) {
        if (solved || selection.includes(id)) return;
        const index = selection.indexOf(null);
        if (index < 0) return;
        selection[index] = id;
        clearFeedback();
        syncBuilder();
    }
    function undoTile() {
        tileBuffer = "";
        if (solved) return;
        const index = selection.findLastIndex((tile) => tile !== null);
        if (index >= 0) selection[index] = null;
        clearFeedback();
        syncBuilder();
    }
    function syncBuilder() {
        $("word-slots").innerHTML = selection.map((id, index) => {
            const text = id === null ? "" : bank.find((tile) => tile.id === id).text;
            return `<button type="button" class="pa-slot ${text ? "is-filled" : ""} ${solved ? "is-correct" : ""}" data-slot="${index}" ${solved || id === null ? "disabled" : ""} aria-label="${escape(text ? t("slot", { n: index + 1, letter: text }) : t("emptySlot", { n: index + 1 }))}">${text || '<span aria-hidden="true">·</span>'}</button>`;
        }).join("");
        area.querySelectorAll("[data-slot]").forEach((button) => { button.onclick = () => { selection[Number(button.dataset.slot)] = null; clearFeedback(); syncBuilder(); }; });
        area.querySelectorAll("[data-tile]").forEach((button) => { button.disabled = solved || selection.includes(Number(button.dataset.tile)); });
        $("check-word").disabled = solved || selection.includes(null);
        $("undo-letter").disabled = solved || selection.every((id) => id === null);
        $("clear-word").disabled = solved || selection.every((id) => id === null);
    }
    function checkWord() {
        if (solved || selection.includes(null)) return;
        const built = selection.map((id) => bank.find((tile) => tile.id === id).text).join("");
        if (normalize(built) === normalize(active.text)) {
            reward("words", active.id);
            syncBuilder();
            announce(t("correctWord", { word: active.text }), "success");
            next.textContent = t("nextWord");
            speak(active.text);
        } else {
            recordAttempt(false);
            announce(t("wrongWord"), "retry");
            save();
            updateSummary();
        }
    }
    function renderStory(last, preferred) {
        active = pick(stories(), journey().stories, last, preferred);
        journey().selected.stories = active.id;
        if (storyPage >= active.pages.length) storyPage = 0;
        // Resume on the first unfinished page after a reload or book change.
        if (storyPage === 0 && !journey().stories.includes(active.id)) {
            const unfinished = active.pages.findIndex((_, index) => !journey().pages.includes(`${active.id}:${index}`));
            if (unfinished > 0) storyPage = unfinished;
        }
        const page = active.pages[storyPage];
        let charIndex = 0;
        const tokens = page.text.split(/(\s+)/).map((token) => {
            const start = charIndex;
            charIndex += token.length;
            if (!token.trim()) return token;
            return `<button type="button" class="pa-story-word" data-word="${escape(normalize(token))}" data-char-start="${start}" data-char-length="${token.length}">${escape(token)}</button>`;
        }).join("");
        area.innerHTML = `<div class="pa-story-picker"><label class="pa-sr" for="story-select">${t("chooseStory")}</label><select id="story-select">${stories().map((story) => `<option value="${story.id}" ${story.id === active.id ? "selected" : ""}>${story.emoji} ${story.title}${journey().stories.includes(story.id) ? " ✓" : ""}</option>`).join("")}</select><span>${t("page", { n: storyPage + 1, total: active.pages.length })}</span></div>
            <div class="pa-book"><div class="pa-book-heading"><h2 id="activity-title" tabindex="-1">${active.title}</h2><div class="pa-book-dots" aria-hidden="true">${active.pages.map((_, index) => `<span class="${index === storyPage ? "is-current" : ""} ${journey().pages.includes(`${active.id}:${index}`) ? "is-read" : ""}"></span>`).join("")}</div></div><span class="pa-book-picture" aria-hidden="true">${page.emoji}</span><p class="pa-story-sentence" id="story-sentence">${tokens}</p><button type="button" class="pa-button pa-listen" id="read-story" aria-pressed="false" ${!state.audio || !speechSupported ? "disabled" : ""}>${t("readTogether")}</button></div>
            <div class="pa-story-challenge"><div><span>${t("findWord")}</span><strong>${page.target}</strong></div>${listenButton("listen-target")}<p>${t("storyHint")}</p></div>`;
        $("activity-tip").textContent = t("storyTip");
        next.textContent = t(storyPage === active.pages.length - 1 ? "nextBook" : "nextPage");
        next.disabled = true;
        $("story-select").onchange = (event) => { storyPage = 0; renderActivity({ specific: event.target.value }); };
        $("read-story").onclick = () => { if (speaking) stopSpeech(); else speak(page.text, { track: true }); };
        $("listen-target").onclick = () => speak(t("storyListen", { word: page.target }));
        area.querySelectorAll("[data-word]").forEach((button) => {
            button.onclick = () => {
                if (solved || button.disabled) return;
                if (button.dataset.word === normalize(page.target)) {
                    button.classList.add("is-correct");
                    reward("pages", `${active.id}:${storyPage}`);
                    const finishedBook = active.pages.every((_, index) => journey().pages.includes(`${active.id}:${index}`));
                    if (finishedBook && !journey().stories.includes(active.id)) {
                        journey().stories.push(active.id);
                        save();
                        updateSummary();
                    }
                    announce(t(storyPage === active.pages.length - 1 && finishedBook ? "storyDone" : "correctStory", { word: page.target, title: active.title }), "success");
                    area.querySelectorAll("[data-word]").forEach((word) => { word.disabled = true; });
                } else {
                    recordAttempt(false);
                    button.classList.add("is-wrong");
                    button.disabled = true;
                    announce(t("wrongStory"), "retry");
                    save();
                    updateSummary();
                }
            };
        });
    }
    function focusTitle() { $("activity-title")?.focus({ preventScroll: true }); }
    function changeMode(mode) {
        if (!MODES.includes(mode) || journey().mode === mode) return;
        journey().mode = mode;
        storyPage = 0;
        renderActivity();
    }
    next.onclick = () => {
        if (journey().mode === "stories") {
            if (!solved) return;
            if (storyPage < active.pages.length - 1) {
                storyPage += 1;
                renderActivity({ specific: active.id });
            } else {
                storyPage = 0;
                renderActivity({ advancing: true });
            }
        } else renderActivity({ advancing: true });
        focusTitle();
    };
    document.querySelectorAll("[data-mode]").forEach((button, index) => {
        button.onclick = () => changeMode(button.dataset.mode);
        button.onkeydown = (event) => {
            let newIndex;
            if (event.key === "ArrowRight") newIndex = (index + 1) % MODES.length;
            if (event.key === "ArrowLeft") newIndex = (index + MODES.length - 1) % MODES.length;
            if (event.key === "Home") newIndex = 0;
            if (event.key === "End") newIndex = MODES.length - 1;
            if (newIndex !== undefined) {
                event.preventDefault();
                changeMode(MODES[newIndex]);
                $(`tab-${MODES[newIndex]}`).focus();
            }
        };
    });
    document.querySelectorAll("[data-language]").forEach((button) => {
        button.onclick = () => {
            if (state.language === button.dataset.language) return;
            stopSpeech();
            state.language = button.dataset.language;
            storyPage = 0;
            translate();
            renderActivity();
        };
    });
    $("audio-toggle").onclick = () => {
        if (!speechSupported) { $("grownups").open = true; return; }
        stopSpeech();
        state.audio = !state.audio;
        updateAudioButton();
        area.querySelectorAll(".pa-listen").forEach((button) => { button.disabled = !state.audio; });
        save();
    };
    $("voice-speed").onchange = (event) => { stopSpeech(); state.rate = Number(event.target.value) === 0.9 ? 0.9 : 0.7; save(); };
    function setFocus(enabled) {
        focusMode = enabled;
        document.body.classList.toggle("pa-focus-mode", enabled);
        $("focus-toggle").setAttribute("aria-pressed", String(enabled));
        $("focus-toggle").textContent = t(enabled ? "exitFocus" : "focus");
        if (enabled) $("activity-panel").scrollIntoView({ block: "start" });
    }
    $("focus-toggle").onclick = () => setFocus(!focusMode);
    $("reset-progress").onclick = () => {
        if (!window.confirm(t("resetConfirm"))) return;
        stopSpeech();
        state.journeys[state.language] = freshJourney();
        storyPage = 0;
        translate();
        renderActivity();
        announce(t("resetDone"));
    };
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && focusMode) { setFocus(false); $("focus-toggle").focus(); }
        if (journey().mode !== "words" || solved || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.target.closest("input, select, textarea, [contenteditable], .pa-language, .pa-path, .pa-grownups, .pa-tools") || !event.target.closest("#activity-panel")) return;
        if (event.key === "Backspace" || event.key === "Delete") { event.preventDefault(); undoTile(); }
        else if (event.key === "Enter" && event.target === $("activity-panel")) { event.preventDefault(); checkWord(); }
        else if (event.key.length === 1 && /\p{L}/u.test(event.key)) {
            // Accumulate multi-letter teams so typing “sh” adds the “sh” tile.
            const available = bank.filter((tile) => !selection.includes(tile.id));
            let typed = tileBuffer + event.key.toLowerCase();
            if (!available.some((tile) => tile.text.startsWith(typed))) typed = event.key.toLowerCase();
            const candidate = available.find((tile) => tile.text === typed);
            if (candidate) { event.preventDefault(); tileBuffer = ""; addTile(candidate.id); }
            else if (available.some((tile) => tile.text.startsWith(typed))) { event.preventDefault(); tileBuffer = typed; }
            else tileBuffer = "";
        }
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stopSpeech(); else { refreshDay(); updateSummary(); save(); } });
    window.addEventListener("pagehide", stopSpeech);
    translate();
    renderActivity();
    if (migrated) announce(t("legacy"));
});
