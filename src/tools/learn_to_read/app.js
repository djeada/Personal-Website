document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const activityArea = document.getElementById("activity-area");
    const loadingMessage = document.getElementById("loading-message");
    const activityIcon = document.getElementById("activity-icon");
    const activityTitle = document.getElementById("activity-title");
    const characterCanvas = document.getElementById("character-canvas");
    const characterSpeech = document.getElementById("character-speech");
    const toastContainer = document.getElementById("toast-container");
    const prevBtn = document.getElementById("prev-btn");
    const nextBtn = document.getElementById("next-btn");
    const resetBtn = document.getElementById("reset-btn");
    const langButtons = document.querySelectorAll(".lang-btn");
    const activityCard = document.getElementById("activity-card");
    const fullscreenExitBtn = document.getElementById("fullscreen-exit-btn");
    const fullscreenEnterBtn = document.getElementById("fullscreen-enter-btn");

    // Stats elements
    const starsCount = document.getElementById("stars-count");
    const soundsLearned = document.getElementById("sounds-learned");
    const wordsLearned = document.getElementById("words-learned");
    const storiesRead = document.getElementById("stories-read");
    const parentPhase = document.getElementById("parent-phase");
    const parentProgress = document.getElementById("parent-progress");

    // Character canvas context
    const ctx = characterCanvas.getContext("2d");

    // Fisher-Yates shuffle algorithm for unbiased randomization
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Learning phases
    const PHASES = {
        SOUNDS: "sounds",
        WORDS: "words",
        SENTENCES: "sentences"
    };

    const TRANSLATIONS = {
        en: {
            "header.title": "Phonics Adventure",
            "header.subtitle": "Learn to read through sounds, words, and stories! Tap letters to hear sounds, build words, and follow along with fun stories.",
            "phase.sounds": "Letters",
            "phase.words": "Words",
            "phase.stories": "Stories",
            "stats.stars": "Stars",
            "stats.sounds": "Letters",
            "stats.words": "Words",
            "stats.stories": "Stories",
            "loading": "Loading activities...",
            "nav.back": "Back",
            "nav.next": "Next",
            "help.title": "👨‍👩‍👧 Parent Info",
            "help.currentPhaseLabel": "Current Phase:",
            "help.progressLabel": "Progress:",
            "help.phaseInfo": "Children progress through phases: Sounds → Words → Stories",
            "help.masteryInfo": "Each phase must be mastered before moving on",
            "help.autoSaveInfo": "Progress is saved automatically in this browser",
            "help.audioHint": "Tap the 🔊 button to hear sounds and words",
            "help.resetHint": "Use the Reset button below to start over",
            "help.resetButton": "🔄 Reset Progress",
            "help.soundsSummary": "Letters tried/right:",
            "help.wordsSummary": "Words tried/right:",
            "help.storiesSummary": "Stories tried/right:",
            "activity.soundsTitle": "Letters",
            "activity.wordsTitle": "Words",
            "activity.storiesTitle": "Story Time",
            "sounds.prompt": "Listen to each face, then connect the right sound!",
            "sounds.instructions": "Tap each face to hear its sound, then drag from the letter to the correct face.",
            "sounds.letterTitle": "Letter",
            "sounds.dragToFace": "Drag to a face!",
            "sounds.matchToast": "You matched \"{letter}\"!",
            "sounds.matchAgain": "Nice! \"{letter}\" again.",
            "sounds.tryAnotherFace": "Try another face!",
            "words.prompt": "Listen to the sound and build the word.",
            "words.speak": "Listen carefully.",
            "words.instructions": "Drag the letters into the boxes to match the sound.",
            "words.tryAgain": "Try again!",
            "words.builtToast": "You built \"{word}\"!",
            "stories.prompt": "Let's read a story together!",
            "stories.speak": "Let's read a story together!",
            "stories.readButton": "Read Story",
            "stories.greatReading": "Great reading!",
            "stories.instructions": "Fill the missing word to continue the story.",
            "confirm.reset": "Are you sure you want to reset all progress?",
            "toast.saveFail": "Could not save progress",
            "toast.reset": "Progress reset!",
            "toast.newPhase": "New phase unlocked!",
            "toast.unlockSpeak": "Great job! You unlocked a new level!",
            "toast.unlockMore": "Complete more activities to unlock!",
            "toast.welcome": "Welcome to Phonics Adventure!"
        },
        de: {
            "header.title": "Lese-Abenteuer",
            "header.subtitle": "Lerne lesen mit Lauten, Wörtern und Geschichten! Tippe auf Buchstaben, höre die Laute, baue Wörter und lies lustige Geschichten.",
            "phase.sounds": "Buchstaben",
            "phase.words": "Wörter",
            "phase.stories": "Geschichten",
            "stats.stars": "Sterne",
            "stats.sounds": "Buchstaben",
            "stats.words": "Wörter",
            "stats.stories": "Geschichten",
            "loading": "Aktivitäten werden geladen...",
            "nav.back": "Zurück",
            "nav.next": "Weiter",
            "help.title": "👨‍👩‍👧 Elterninfo",
            "help.currentPhaseLabel": "Aktuelle Phase:",
            "help.progressLabel": "Fortschritt:",
            "help.phaseInfo": "Kinder durchlaufen Phasen: Laute → Wörter → Geschichten",
            "help.masteryInfo": "Jede Phase muss gemeistert werden, bevor es weitergeht",
            "help.autoSaveInfo": "Fortschritt wird automatisch in diesem Browser gespeichert",
            "help.audioHint": "Tippe auf 🔊, um Laute und Wörter zu hören",
            "help.resetHint": "Nutze den Reset-Button unten, um neu zu starten",
            "help.resetButton": "🔄 Fortschritt zurücksetzen",
            "help.soundsSummary": "Buchstaben versucht/richtig:",
            "help.wordsSummary": "Wörter versucht/richtig:",
            "help.storiesSummary": "Geschichten versucht/richtig:",
            "activity.soundsTitle": "Buchstaben",
            "activity.wordsTitle": "Wörter",
            "activity.storiesTitle": "Geschichtenzeit",
            "sounds.prompt": "Höre dir jedes Gesicht an und verbinde den richtigen Laut!",
            "sounds.instructions": "Tippe jedes Gesicht an, höre den Laut und ziehe den Buchstaben zum richtigen Gesicht.",
            "sounds.letterTitle": "Buchstabe",
            "sounds.dragToFace": "Ziehe zu einem Gesicht!",
            "sounds.matchToast": "Du hast \"{letter}\" verbunden!",
            "sounds.matchAgain": "Super! \"{letter}\" nochmal.",
            "sounds.tryAnotherFace": "Versuch ein anderes Gesicht!",
            "words.prompt": "Höre den Laut und baue das Wort.",
            "words.speak": "Hör genau zu.",
            "words.instructions": "Ziehe die Buchstaben in die Kästchen passend zum Laut.",
            "words.tryAgain": "Versuch es nochmal!",
            "words.builtToast": "Du hast \"{word}\" gebaut!",
            "stories.prompt": "Lass uns zusammen eine Geschichte lesen!",
            "stories.speak": "Lass uns zusammen eine Geschichte lesen!",
            "stories.readButton": "Geschichte vorlesen",
            "stories.greatReading": "Super gelesen!",
            "stories.instructions": "Setze das fehlende Wort ein, um weiterzulesen.",
            "confirm.reset": "Möchtest du den gesamten Fortschritt wirklich zurücksetzen?",
            "toast.saveFail": "Fortschritt konnte nicht gespeichert werden",
            "toast.reset": "Fortschritt zurückgesetzt!",
            "toast.newPhase": "Neue Phase freigeschaltet!",
            "toast.unlockSpeak": "Super gemacht! Du hast ein neues Level freigeschaltet!",
            "toast.unlockMore": "Mache mehr Aktivitäten, um freizuschalten!",
            "toast.welcome": "Willkommen im Lese-Abenteuer!"
        }
    };

    function t(key, vars = {}) {
        const strings = TRANSLATIONS[state.language] || TRANSLATIONS.en;
        const fallback = TRANSLATIONS.en[key] || key;
        const template = strings[key] || fallback;
        return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? "");
    }

    function applyTranslations() {
        document.querySelectorAll("[data-i18n]").forEach((el) => {
            const key = el.dataset.i18n;
            el.textContent = t(key);
        });
    }

    const ENCOURAGEMENTS = {
        en: [
            "Great job!",
            "You did it!",
            "Wonderful!",
            "Amazing!",
            "Keep going!",
            "You're a star!"
        ],
        de: [
            "Toll gemacht!",
            "Du hast es geschafft!",
            "Wunderbar!",
            "Großartig!",
            "Mach weiter so!",
            "Du bist ein Star!"
        ]
    };

    // Letter data with phonics sounds
    const LETTERS = [
        { letter: "A", sound: "a", example: "apple" },
        { letter: "B", sound: "b", example: "ball" },
        { letter: "C", sound: "k", example: "cat" },
        { letter: "D", sound: "d", example: "dog" },
        { letter: "E", sound: "e", example: "egg" },
        { letter: "F", sound: "f", example: "fish" },
        { letter: "G", sound: "g", example: "goat" },
        { letter: "H", sound: "h", example: "hat" },
        { letter: "I", sound: "i", example: "igloo" },
        { letter: "J", sound: "j", example: "jam" },
        { letter: "K", sound: "k", example: "kite" },
        { letter: "L", sound: "l", example: "lion" },
        { letter: "M", sound: "m", example: "mouse" },
        { letter: "N", sound: "n", example: "nest" },
        { letter: "O", sound: "o", example: "octopus" },
        { letter: "P", sound: "p", example: "pig" },
        { letter: "Q", sound: "q", example: "queen" },
        { letter: "R", sound: "r", example: "rabbit" },
        { letter: "S", sound: "s", example: "sun" },
        { letter: "T", sound: "t", example: "turtle" },
        { letter: "U", sound: "u", example: "umbrella" },
        { letter: "V", sound: "v", example: "van" },
        { letter: "W", sound: "w", example: "whale" },
        { letter: "X", sound: "x", example: "box" },
        { letter: "Y", sound: "y", example: "yellow" },
        { letter: "Z", sound: "z", example: "zebra" }
    ];

    const SHORT_WORDS = [
        "am", "an", "as", "at", "be", "by", "do", "go", "he", "hi",
        "if", "in", "is", "it", "me", "my", "no", "of", "oh", "on",
        "or", "ox", "up", "us", "we", "to", "so", "pi", "ex", "ace",
        "act", "add", "age", "ago", "air", "and", "ant", "any", "ape", "arm",
        "art", "ash", "ask", "ate", "awe", "bad", "bag", "ban", "bar", "bat",
        "bay", "bed", "bee", "beg", "bet", "bib", "bid", "big", "bin", "bit",
        "bog", "box", "boy", "bud", "bug", "bun", "bus", "but", "buy", "cab",
        "can", "cap", "car", "cat", "cop", "cow", "cry", "cup", "cut", "dad",
        "dam", "day", "den", "did", "dig", "dim", "din", "dip", "dog", "dot",
        "dry", "due", "dug", "dye", "ear", "eat", "eel", "egg", "elf", "elk",
        "elm", "end", "era", "eve", "eye", "fan", "far", "fat", "fed", "fee",
        "few", "fig", "fin", "fit", "fix", "fog", "for", "fox", "fun", "fur",
        "gas", "gem", "get", "gig", "gin", "gum", "gun", "guy", "had", "ham",
        "has", "hat", "hay", "hen", "her", "hid", "him", "hip", "his", "hit",
        "hog", "hop", "hot", "how", "hug", "hut", "ice", "icy", "ink", "jam",
        "jar", "jaw", "jet", "job", "jog", "joy", "key", "kid", "kin", "kit",
        "lab", "lad", "lag", "lap", "law", "lay", "leg", "let", "lid", "lip",
        "lit", "log", "lot", "low", "mad", "man", "map", "mat", "men", "met",
        "mix", "mom", "mop", "mud", "mug", "nap", "net", "new", "nod", "nor",
        "now", "nut", "oak", "odd", "off", "old", "one", "out", "owl", "own",
        "pad", "pal", "pan", "par", "pat", "paw", "pay", "pen", "pet", "pig",
        "pin", "pip", "pit", "ply", "pod", "pop", "pot", "put", "rag", "ram",
        "ran", "rap", "rat", "raw", "red", "rid", "rig", "rim", "rip", "rob",
        "rod", "rot", "row", "rub", "rug", "run", "sad", "sap", "sat", "say",
        "sea", "see", "set", "shy", "sip", "sit", "six", "ski", "sky", "sly",
        "sob", "son", "sow", "sun", "tab", "tag", "tan", "tap", "tar", "tea",
        "ten", "the", "tie", "tin", "tip", "toe", "ton", "top", "toy", "try",
        "tub", "tug", "two", "use", "van", "vat", "vet", "vow", "wag", "war",
        "was", "wax", "way", "web", "wet", "who", "why", "win", "wit", "won",
        "yes", "yet", "you", "zap", "zig", "zip", "zoo", "able", "acid", "aged"
    ];

    const STORIES = [
        {
            title: "The Cat",
            sentences: [
                { text: "The ____ sat on a mat.", missing: "cat" },
                { text: "The cat is ____.", missing: "fat" },
                { text: "The cat can ____.", missing: "nap" }
            ]
        },
        {
            title: "The Dog",
            sentences: [
                { text: "The ____ ran to the log.", missing: "dog" },
                { text: "The dog dug in the ____.", missing: "mud" },
                { text: "The dog is ____.", missing: "fun" }
            ]
        },
        {
            title: "The Sun",
            sentences: [
                { text: "The sun is ____.", missing: "hot" },
                { text: "The sun is ____.", missing: "up" },
                { text: "I run in the ____.", missing: "sun" }
            ]
        }
    ];

    // Progress state
    let state = {
        currentPhase: PHASES.SOUNDS,
        currentActivity: 0,
        stars: 0,
        masteredSounds: [],
        masteredWords: [],
        completedStories: [],
        language: "en",
        activityStats: {
            sounds: { attempts: 0, correct: 0 },
            words: { attempts: 0, correct: 0 },
            stories: { attempts: 0, correct: 0 }
        },
        phaseProgress: {
            sounds: 0,
            words: 0,
            sentences: 0
        }
    };

    // Audio system using Web Speech API with feature detection
    const AudioSystem = {
        synth: typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null,
        speaking: false,
        supported: typeof window !== 'undefined' && 'speechSynthesis' in window,

        speak(text, rate = 0.8, pitch = 1.2) {
            if (!this.supported || !this.synth) {
                console.warn('Web Speech API not supported');
                return;
            }

            if (this.synth.speaking) {
                this.synth.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate;
            utterance.pitch = pitch;
            utterance.volume = 1;
            utterance.lang = state.language === "de" ? "de-DE" : "en-US";

            // Try to use a child-friendly voice with robust detection
            const voices = this.synth.getVoices();
            const desiredLang = state.language === "de" ? "de" : "en";
            const preferredVoice = voices.find(v =>
                v.lang.startsWith(desiredLang) && v.default
            ) || voices.find(v =>
                v.lang.startsWith(desiredLang)
            );

            if (preferredVoice) {
                utterance.voice = preferredVoice;
            }

            utterance.onstart = () => {
                this.speaking = true;
                animateCharacterMouth(true);
            };

            utterance.onend = () => {
                this.speaking = false;
                animateCharacterMouth(false);
            };

            this.synth.speak(utterance);
        },

        speakLetter(letter) {
            const letterData = LETTERS.find(l => l.letter === letter.toUpperCase());
            if (letterData) {
                this.speak(letterData.sound, 0.6, 1.3);
            }
        },

        speakWord(word, slow = false) {
            if (slow) {
                // Speak each letter sound, then the word
                const letters = word.split("");
                let delay = 0;
                letters.forEach((letter, index) => {
                    setTimeout(() => this.speakLetter(letter), delay);
                    delay += 600;
                });
                setTimeout(() => this.speak(word, 0.7, 1.2), delay + 300);
            } else {
                this.speak(word, 0.8, 1.2);
            }
        },

        speakEncouragement() {
            const phrases = ENCOURAGEMENTS[state.language] || ENCOURAGEMENTS.en;
            const phrase = phrases[Math.floor(Math.random() * phrases.length)];
            this.speak(phrase, 1, 1.3);
        }
    };

    // Character animation system
    let characterState = {
        mouthOpen: false,
        eyesBlink: false,
        emotion: "happy" // happy, excited, thinking
    };

    function drawCharacter() {
        ctx.clearRect(0, 0, 200, 200);

        // Body (circle)
        ctx.fillStyle = "#FFD93D";
        ctx.beginPath();
        ctx.arc(100, 100, 80, 0, Math.PI * 2);
        ctx.fill();

        // Body outline
        ctx.strokeStyle = "#F5B700";
        ctx.lineWidth = 3;
        ctx.stroke();

        // Eyes
        const eyeY = characterState.eyesBlink ? 75 : 70;
        const eyeHeight = characterState.eyesBlink ? 3 : 20;

        // Left eye
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(70, eyeY, 15, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Left pupil
        if (!characterState.eyesBlink) {
            ctx.fillStyle = "#333";
            ctx.beginPath();
            ctx.arc(70, 75, 8, 0, Math.PI * 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(73, 72, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Right eye
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(130, eyeY, 15, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Right pupil
        if (!characterState.eyesBlink) {
            ctx.fillStyle = "#333";
            ctx.beginPath();
            ctx.arc(130, 75, 8, 0, Math.PI * 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(133, 72, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mouth
        if (characterState.mouthOpen) {
            ctx.fillStyle = "#FF6B6B";
            ctx.beginPath();
            ctx.ellipse(100, 130, 24, 18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#E85555";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.strokeStyle = "#E85555";
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(100, 132, 20, 0, Math.PI);
            ctx.stroke();
        }

        // Cheeks (blush)
        ctx.fillStyle = "rgba(255, 150, 150, 0.4)";
        ctx.beginPath();
        ctx.arc(45, 110, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(155, 110, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    function animateCharacterMouth(open) {
        characterState.mouthOpen = open;
        drawCharacter();
    }

    function blinkEyes() {
        characterState.eyesBlink = true;
        drawCharacter();
        setTimeout(() => {
            characterState.eyesBlink = false;
            drawCharacter();
        }, 150);
    }

    // Start blinking animation and store interval ID for cleanup
    let blinkIntervalId = setInterval(blinkEyes, 4000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (blinkIntervalId) {
            clearInterval(blinkIntervalId);
        }
    });

    function showCharacterSpeech(text) {
        characterSpeech.textContent = text;
        characterSpeech.classList.add("visible");
        setTimeout(() => {
            characterSpeech.classList.remove("visible");
        }, 4000);
    }

    // Toast notifications
    function showToast(message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        const icons = {
            success: "🎉",
            error: "😕",
            info: "💡",
            warning: "⚠️"
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Celebration effect
    function celebrate() {
        const celebration = document.createElement("div");
        celebration.className = "celebration";
        document.body.appendChild(celebration);

        const emojis = ["⭐", "🌟", "✨", "🎉", "🎊"];
        for (let i = 0; i < 20; i++) {
            const star = document.createElement("span");
            star.className = "star-burst";
            star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            star.style.left = Math.random() * 100 + "%";
            star.style.top = Math.random() * 100 + "%";
            star.style.animationDelay = Math.random() * 0.5 + "s";
            celebration.appendChild(star);
        }

        setTimeout(() => celebration.remove(), 2000);
    }

    // Progress management
    function loadProgress() {
        try {
            const saved = localStorage.getItem("learnToReadProgress");
            if (saved) {
                state = JSON.parse(saved);
            }
        } catch (e) {
            console.error("Error loading progress:", e);
        }
        if (!state.language) {
            state.language = "en";
        }
        if (state.currentPhase === "blends") {
            state.currentPhase = PHASES.WORDS;
        }
        if (!state.activityStats) {
            state.activityStats = {
                sounds: { attempts: 0, correct: 0 },
                words: { attempts: 0, correct: 0 },
                stories: { attempts: 0, correct: 0 }
            };
        }
        if (!state.activityStats.words) {
            state.activityStats.words = { attempts: 0, correct: 0 };
        }
        updateUI();
    }

    function saveProgress() {
        try {
            localStorage.setItem("learnToReadProgress", JSON.stringify(state));
        } catch (e) {
            console.error("Error saving progress:", e);
            showToast(t("toast.saveFail"), "warning");
        }
        updateUI();
    }

    function resetProgress() {
        if (confirm(t("confirm.reset"))) {
            try {
                localStorage.removeItem("learnToReadProgress");
            } catch (e) {
                console.error("Error clearing progress:", e);
            }
            state = {
                currentPhase: PHASES.SOUNDS,
                currentActivity: 0,
                stars: 0,
                masteredSounds: [],
                masteredWords: [],
                completedStories: [],
                language: state.language || "en",
                activityStats: {
                    sounds: { attempts: 0, correct: 0 },
                    words: { attempts: 0, correct: 0 },
                    stories: { attempts: 0, correct: 0 }
                },
                phaseProgress: {
                    sounds: 0,
                    words: 0,
                    sentences: 0
                }
            };
            saveProgress();
            loadActivity();
            showToast(t("toast.reset"), "info");
        }
    }

    function updateUI() {
        // Update stats
        starsCount.textContent = state.stars;
        soundsLearned.textContent = state.masteredSounds.length;
        wordsLearned.textContent = state.masteredWords.length;
        storiesRead.textContent = state.completedStories.length;

        // Update phase indicators
        const phases = [PHASES.SOUNDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);

        document.querySelectorAll(".phase-item").forEach((item, index) => {
            item.classList.remove("active", "completed", "locked");
            if (index < currentIndex) {
                item.classList.add("completed");
            } else if (index === currentIndex) {
                item.classList.add("active");
            }
        });

        document.querySelectorAll(".phase-connector").forEach((connector, index) => {
            connector.classList.toggle("completed", index < currentIndex);
        });

        // Update parent info
        const phaseNames = {
            sounds: t("activity.soundsTitle"),
            words: t("activity.wordsTitle"),
            sentences: t("activity.storiesTitle")
        };
        parentPhase.textContent = phaseNames[state.currentPhase];

        const totalProgress = calculateTotalProgress();
        parentProgress.textContent = totalProgress + "%";

        const soundsTried = document.getElementById("sounds-tried");
        const soundsRight = document.getElementById("sounds-right");
        const wordsTried = document.getElementById("words-tried");
        const wordsRight = document.getElementById("words-right");
        const storiesTried = document.getElementById("stories-tried");
        const storiesRight = document.getElementById("stories-right");

        if (soundsTried) soundsTried.textContent = state.activityStats.sounds.attempts;
        if (soundsRight) soundsRight.textContent = state.activityStats.sounds.correct;
        if (wordsTried) wordsTried.textContent = state.activityStats.words.attempts;
        if (wordsRight) wordsRight.textContent = state.activityStats.words.correct;
        if (storiesTried) storiesTried.textContent = state.activityStats.stories.attempts;
        if (storiesRight) storiesRight.textContent = state.activityStats.stories.correct;
    }

    function calculateTotalProgress() {
        const soundProgress = (state.masteredSounds.length / LETTERS.length) * 25;
        const wordProgress = (state.masteredWords.length / SHORT_WORDS.length) * 50;
        const storyProgress = (state.completedStories.length / STORIES.length) * 25;
        return Math.round(soundProgress + wordProgress + storyProgress);
    }

    function canUnlockPhase(phase) {
        return true;
    }

    function checkPhaseProgression() {
        const phases = [PHASES.SOUNDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);

        if (currentIndex < phases.length - 1) {
            const nextPhase = phases[currentIndex + 1];
            if (canUnlockPhase(nextPhase)) {
                state.currentPhase = nextPhase;
                state.currentActivity = 0;
                saveProgress();
                showToast(t("toast.newPhase"), "success");
                celebrate();
                AudioSystem.speak(t("toast.unlockSpeak"));
            }
        }
    }

    // Activity rendering
    function loadActivity() {
        loadingMessage.style.display = "none";

        switch (state.currentPhase) {
            case PHASES.SOUNDS:
                renderSoundsActivity();
                break;
            case PHASES.WORDS:
                renderWordsActivity();
                break;
            case PHASES.SENTENCES:
                renderStoriesActivity();
                break;
        }

        updateNavigationButtons();
    }

    function requestActivityFullscreen() {
        if (!document.fullscreenEnabled || document.fullscreenElement) {
            return;
        }
        if (activityCard && activityCard.requestFullscreen) {
            activityCard.requestFullscreen().catch(() => {});
        }
    }

    function exitActivityFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
    }

    function updateNavigationButtons() {
        const phases = [PHASES.SOUNDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);

        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = !canUnlockPhase(phases[currentIndex + 1]);
    }

    function updateLanguageButtons() {
        langButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.lang === state.language);
        });
    }

    function setLanguage(lang) {
        if (lang === state.language) return;
        state.language = lang;
        saveProgress();
        applyTranslations();
        updateLanguageButtons();
        loadActivity();
        updateUI();
    }

    function getNextSoundIndex() {
        return Math.floor(Math.random() * LETTERS.length);
    }

    function getSoundChoices(targetLetter) {
        const choices = [targetLetter];
        while (choices.length < 3) {
            const randomLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)].letter;
            if (!choices.includes(randomLetter)) {
                choices.push(randomLetter);
            }
        }
        return shuffleArray(choices);
    }

    // Sounds activity
    function renderSoundsActivity() {
        activityIcon.textContent = "🔤";
        activityTitle.textContent = t("activity.soundsTitle");

        showCharacterSpeech(t("sounds.prompt"));

        const targetIndex = getNextSoundIndex();
        state.currentActivity = targetIndex;
        const target = LETTERS[targetIndex];
        const choices = getSoundChoices(target.letter);
        const shapes = ["circle", "squircle", "blob"];

        let html = `
            <div class="sounds-stage">
                <div class="drag-layer" aria-hidden="true">
                    <span class="drag-line" id="drag-line"></span>
                </div>
                <div class="letter-zone">
                    <div class="letter-card" id="target-letter-card" data-letter="${target.letter}">
                        <span class="letter-title">${t("sounds.letterTitle")}</span>
                        <span class="letter-display">${target.letter}</span>
                    </div>
                </div>
                <div class="shape-zone">
                    <p class="shape-instructions">${t("sounds.instructions")}</p>
                    <div class="shape-row">
                        ${choices.map((letter, index) => `
                            <button class="shape-choice" data-letter="${letter}" aria-label="Play a letter sound">
                                <span class="shape-body shape-${shapes[index % shapes.length]}">
                                    <span class="shape-face">
                                        <span class="eye"></span>
                                        <span class="eye"></span>
                                        <span class="mouth"></span>
                                        <span class="blush blush-left"></span>
                                        <span class="blush blush-right"></span>
                                    </span>
                                </span>
                            </button>
                        `).join("")}
                    </div>
                </div>
            </div>
        `;

        activityArea.innerHTML = html;

        const shapeButtons = activityArea.querySelectorAll(".shape-choice");
        const letterCard = document.getElementById("target-letter-card");
        const dragLine = document.getElementById("drag-line");
        const stage = activityArea.querySelector(".sounds-stage");
        let locked = false;
        let dragging = false;
        let hoverTarget = null;

        shapeButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                if (locked) return;
                const letter = btn.dataset.letter;
                AudioSystem.speakLetter(letter);
                btn.classList.add("speaking");
                setTimeout(() => btn.classList.remove("speaking"), 700);
            });
        });

        function getStagePoint(event) {
            const rect = stage.getBoundingClientRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
        }

        function getLetterCenter() {
            const rect = letterCard.getBoundingClientRect();
            const stageRect = stage.getBoundingClientRect();
            return {
                x: rect.left - stageRect.left + rect.width / 2,
                y: rect.top - stageRect.top + rect.height / 2
            };
        }

        function setDragLine(start, end) {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            dragLine.style.width = `${length}px`;
            dragLine.style.transform = `translate(${start.x}px, ${start.y}px) rotate(${angle}deg)`;
        }

        function getButtonCenter(button) {
            const rect = button.getBoundingClientRect();
            const stageRect = stage.getBoundingClientRect();
            return {
                x: rect.left - stageRect.left + rect.width / 2,
                y: rect.top - stageRect.top + rect.height / 2
            };
        }

        function updateHoverTarget(targetButton) {
            if (hoverTarget && hoverTarget !== targetButton) {
                hoverTarget.classList.remove("hovered");
            }
            hoverTarget = targetButton;
            if (hoverTarget) {
                hoverTarget.classList.add("hovered");
            }
        }

        letterCard.addEventListener("pointerdown", (event) => {
            if (locked) return;
            dragging = true;
            letterCard.setPointerCapture(event.pointerId);
            letterCard.classList.add("dragging");
            dragLine.classList.add("visible");

            const start = getLetterCenter();
            const point = getStagePoint(event);
            setDragLine(start, point);
        });

        letterCard.addEventListener("pointermove", (event) => {
            if (!dragging) return;
            const start = getLetterCenter();
            const point = getStagePoint(event);
            setDragLine(start, point);

            const element = document.elementFromPoint(event.clientX, event.clientY);
            const targetButton = element ? element.closest(".shape-choice") : null;
            updateHoverTarget(targetButton);
        });

        letterCard.addEventListener("pointerup", (event) => {
            if (!dragging) return;
            dragging = false;
            letterCard.releasePointerCapture(event.pointerId);
            letterCard.classList.remove("dragging");
            dragLine.classList.remove("visible");
            dragLine.style.width = "0px";

            const element = document.elementFromPoint(event.clientX, event.clientY);
            const targetButton = element ? element.closest(".shape-choice") : null;
            updateHoverTarget(null);

            if (!targetButton) {
                showToast(t("sounds.dragToFace"), "info");
                return;
            }

            const letter = targetButton.dataset.letter;
            AudioSystem.speakLetter(letter);
            targetButton.classList.add("speaking");
            setTimeout(() => targetButton.classList.remove("speaking"), 700);

            state.activityStats.sounds.attempts += 1;
            saveProgress();

            if (letter === target.letter) {
                locked = true;
                targetButton.classList.add("matched");
                letterCard.classList.add("matched");
                dragLine.classList.add("visible");
                setDragLine(getLetterCenter(), getButtonCenter(targetButton));
                state.activityStats.sounds.correct += 1;
                saveProgress();

                if (!state.masteredSounds.includes(target.letter)) {
                    state.masteredSounds.push(target.letter);
                    state.stars += 1;
                    saveProgress();
                    showToast(t("sounds.matchToast", { letter: target.letter }), "success");

                    if (state.masteredSounds.length % 5 === 0) {
                        celebrate();
                    }

                    checkPhaseProgression();
                } else {
                    showToast(t("sounds.matchAgain", { letter: target.letter }), "success");
                }

                setTimeout(() => {
                    dragLine.classList.remove("visible");
                    dragLine.style.width = "0px";
                    state.currentActivity = (targetIndex + 1) % LETTERS.length;
                    saveProgress();
                    renderSoundsActivity();
                }, 900);
            } else {
                targetButton.classList.add("wrong");
                showToast(t("sounds.tryAnotherFace"), "info");
                setTimeout(() => targetButton.classList.remove("wrong"), 350);
            }
        });

        letterCard.addEventListener("pointercancel", (event) => {
            if (!dragging) return;
            dragging = false;
            letterCard.releasePointerCapture(event.pointerId);
            letterCard.classList.remove("dragging");
            dragLine.classList.remove("visible");
            dragLine.style.width = "0px";
            updateHoverTarget(null);
        });
    }

    // Words activity
    function renderWordsActivity() {
        activityIcon.textContent = "🔡";
        activityTitle.textContent = t("activity.wordsTitle");

        const word = SHORT_WORDS[Math.floor(Math.random() * SHORT_WORDS.length)];
        const targetLetters = word.toUpperCase().split("");
        const letterBank = shuffleArray([...targetLetters]);

        showCharacterSpeech(t("words.prompt"));

        let html = `
            <div class="word-builder word-dragger">
                <div class="target-word">
                    <button class="sound-btn" id="play-word-btn">🔊</button>
                </div>
                <p class="blend-instructions">${t("words.instructions")}</p>
                <div class="word-slots drag-slots" id="drag-slots">
                    ${targetLetters.map((_, i) => `
                        <div class="word-slot drag-slot" data-index="${i}"></div>
                    `).join("")}
                </div>
                <div class="letter-bank" id="letter-bank">
                    ${letterBank.map((letter, index) => `
                        <button class="letter-tile" draggable="false" data-letter="${letter}" data-tile="${index}">${letter}</button>
                    `).join("")}
                </div>
                <div class="drag-ghost" id="drag-ghost"></div>
            </div>
        `;

        activityArea.innerHTML = html;

        let wordAttempted = false;
        let wordCompleted = false;

        function markWordAttempt() {
            if (wordAttempted) return;
            wordAttempted = true;
            state.activityStats.words.attempts += 1;
            saveProgress();
        }

        function checkWordCompletion() {
            if (wordCompleted) return;
            const slots = Array.from(document.querySelectorAll(".drag-slot"));
            if (slots.some(slot => !slot.dataset.letter)) {
                return;
            }
            const spelled = slots.map(slot => slot.dataset.letter).join("");
            if (spelled === targetLetters.join("")) {
                wordCompleted = true;
                state.activityStats.words.correct += 1;
                state.stars += 5;
                saveProgress();
                showToast(t("words.builtToast", { word }), "success");
                celebrate();
                AudioSystem.speakEncouragement();
                if (!state.masteredWords.includes(word)) {
                    state.masteredWords.push(word);
                    saveProgress();
                }
                setTimeout(() => {
                    state.currentActivity++;
                    saveProgress();
                    renderWordsActivity();
                }, 800);
            } else {
                showToast(t("words.tryAgain"), "info");
            }
        }

        document.getElementById("play-word-btn").addEventListener("click", () => {
            AudioSystem.speakWord(word);
        });

        const tiles = Array.from(document.querySelectorAll(".letter-tile"));
        const slots = Array.from(document.querySelectorAll(".drag-slot"));
        const dragGhost = document.getElementById("drag-ghost");
        let activeTile = null;
        let activeLetter = "";

        function setActiveTile(tile) {
            if (activeTile) {
                activeTile.classList.remove("picked");
            }
            activeTile = tile;
            activeLetter = tile ? tile.dataset.letter : "";
            if (activeTile) {
                activeTile.classList.add("picked");
                activityArea.classList.add("letter-picked");
                dragGhost.textContent = activeLetter;
                dragGhost.classList.add("visible");
            } else {
                activityArea.classList.remove("letter-picked");
                dragGhost.classList.remove("visible");
            }
            slots.forEach((slot) => {
                slot.dataset.preview = "";
            });
        }

        tiles.forEach(tile => {
            tile.addEventListener("click", () => {
                if (tile.classList.contains("used")) return;
                if (activeTile === tile) {
                    setActiveTile(null);
                    return;
                }
                setActiveTile(tile);
            });
        });

        slots.forEach(slot => {
            slot.addEventListener("mouseenter", () => {
                if (!activeLetter || slot.dataset.letter) return;
                slot.dataset.preview = activeLetter;
            });

            slot.addEventListener("mouseleave", () => {
                slot.dataset.preview = "";
            });

            slot.addEventListener("click", () => {
                if (activeTile) {
                    markWordAttempt();
                    if (slot.dataset.tile) {
                        const previousTile = document.querySelector(`.letter-tile[data-tile="${slot.dataset.tile}"]`);
                        if (previousTile) {
                            previousTile.classList.remove("used");
                            previousTile.removeAttribute("aria-disabled");
                        }
                    }
                    slot.textContent = activeLetter;
                    slot.dataset.letter = activeLetter;
                    slot.dataset.tile = activeTile.dataset.tile;
                    slot.classList.add("filled");
                    activeTile.classList.add("used");
                    activeTile.setAttribute("aria-disabled", "true");
                    setActiveTile(null);
                    checkWordCompletion();
                } else if (slot.dataset.letter) {
                    if (slot.dataset.tile) {
                        const previousTile = document.querySelector(`.letter-tile[data-tile="${slot.dataset.tile}"]`);
                        if (previousTile) {
                            previousTile.classList.remove("used");
                            previousTile.removeAttribute("aria-disabled");
                        }
                    }
                    slot.textContent = "";
                    slot.dataset.letter = "";
                    slot.dataset.tile = "";
                    slot.classList.remove("filled");
                }
            });
        });

        activityArea.addEventListener("mousemove", (event) => {
            if (!activeLetter) return;
            const x = event.clientX + 12;
            const y = event.clientY + 12;
            dragGhost.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    // Stories activity
    function renderStoriesActivity() {
        activityIcon.textContent = "📖";
        activityTitle.textContent = t("activity.storiesTitle");

        const storyIndex = state.currentActivity % STORIES.length;
        const story = STORIES[storyIndex];
        let sentenceIndex = 0;
        let storyAttempted = false;

        showCharacterSpeech(t("stories.prompt"));
        AudioSystem.speak(t("stories.speak"));

        function renderSentence() {
            const sentence = story.sentences[sentenceIndex];
            const missing = sentence.missing.toUpperCase();
            const missingLetters = shuffleArray(missing.split(""));

            const parts = sentence.text.split("____");
            const before = parts[0] || "";
            const after = parts[1] || "";

            let html = `
                <div class="story-container">
                    <h3 class="story-title">📖 ${story.title}</h3>
                    <p class="story-instructions">${t("stories.instructions")}</p>
                    <button class="nav-btn primary story-speech-btn" id="story-speech-btn" type="button">
                        <span class="btn-icon">🔊</span>
                        <span class="btn-text">${t("stories.readButton")}</span>
                    </button>
                    <div class="story-sentence">
                        <span>${before}</span>
                        <span class="story-blank" id="story-blank">
                            ${missing.split("").map((_, index) => `
                                <span class="story-letter-slot" data-index="${index}"></span>
                            `).join("")}
                        </span>
                        <span>${after}</span>
                    </div>
                    <div class="letter-bank story-bank" id="story-bank">
                        ${missingLetters.map((letter, index) => `
                            <button class="letter-tile" draggable="false" data-letter="${letter}" data-tile="${index}">${letter}</button>
                        `).join("")}
                    </div>
                    <div class="drag-ghost" id="story-drag-ghost"></div>
                </div>
            `;

            activityArea.innerHTML = html;

            const blank = document.getElementById("story-blank");
            blank.dataset.letters = "";

            function speakSentence() {
                const fullSentence = sentence.text.replace("____", sentence.missing);
                AudioSystem.speak(fullSentence);
            }

            document.getElementById("story-speech-btn").addEventListener("click", () => {
                speakSentence();
            });

            speakSentence();

            const slots = Array.from(document.querySelectorAll(".story-letter-slot"));

            const tiles = Array.from(document.querySelectorAll(".letter-tile"));
            const dragGhost = document.getElementById("story-drag-ghost");
            let activeTile = null;
            let activeLetter = "";

            function setActiveTile(tile) {
                if (activeTile) {
                    activeTile.classList.remove("picked");
                }
                activeTile = tile;
                activeLetter = tile ? tile.dataset.letter : "";
                if (activeTile) {
                    activeTile.classList.add("picked");
                    activityArea.classList.add("letter-picked");
                    dragGhost.textContent = activeLetter;
                    dragGhost.classList.add("visible");
                } else {
                    activityArea.classList.remove("letter-picked");
                    dragGhost.classList.remove("visible");
                }
                slots.forEach((slot) => {
                    slot.dataset.preview = "";
                });
            }

            function evaluateSentence() {
                const filled = slots.every(s => s.dataset.letter);
                if (!filled) return;
                const spelled = slots.map(s => s.dataset.letter).join("");
                if (spelled === missing) {
                    setTimeout(() => {
                        sentenceIndex += 1;
                        if (sentenceIndex >= story.sentences.length) {
                            if (!state.completedStories.includes(story.title)) {
                                state.completedStories.push(story.title);
                                state.stars += 10;
                                saveProgress();
                            }
                            state.activityStats.stories.correct += 1;
                            saveProgress();
                            showToast(t("stories.greatReading"), "success");
                            celebrate();
                            AudioSystem.speakEncouragement();
                            state.currentActivity++;
                            saveProgress();
                            renderStoriesActivity();
                        } else {
                            renderSentence();
                        }
                    }, 400);
                } else {
                    showToast(t("words.tryAgain"), "info");
                }
            }

            tiles.forEach(tile => {
                tile.addEventListener("click", () => {
                    if (tile.classList.contains("used")) return;
                    if (activeTile === tile) {
                        setActiveTile(null);
                        return;
                    }
                    setActiveTile(tile);
                });
            });

            slots.forEach(slot => {
                slot.addEventListener("mouseenter", () => {
                    if (!activeLetter || slot.dataset.letter) return;
                    slot.dataset.preview = activeLetter;
                });

                slot.addEventListener("mouseleave", () => {
                    slot.dataset.preview = "";
                });

                slot.addEventListener("click", () => {
                    if (activeTile) {
                        if (!storyAttempted) {
                            storyAttempted = true;
                            state.activityStats.stories.attempts += 1;
                            saveProgress();
                        }

                        if (slot.dataset.tile) {
                            const prevTile = document.querySelector(`.letter-tile[data-tile="${slot.dataset.tile}"]`);
                            if (prevTile) {
                                prevTile.classList.remove("used");
                                prevTile.removeAttribute("aria-disabled");
                            }
                        }

                        slot.textContent = activeLetter;
                        slot.dataset.letter = activeLetter;
                        slot.dataset.tile = activeTile.dataset.tile;
                        slot.classList.add("filled");

                        activeTile.classList.add("used");
                        activeTile.setAttribute("aria-disabled", "true");
                        setActiveTile(null);
                        evaluateSentence();
                    } else if (slot.dataset.letter) {
                        if (slot.dataset.tile) {
                            const prevTile = document.querySelector(`.letter-tile[data-tile="${slot.dataset.tile}"]`);
                            if (prevTile) {
                                prevTile.classList.remove("used");
                                prevTile.removeAttribute("aria-disabled");
                            }
                        }
                        slot.textContent = "";
                        slot.dataset.letter = "";
                        slot.dataset.tile = "";
                        slot.classList.remove("filled");
                    }
                });
            });

            activityArea.addEventListener("mousemove", (event) => {
                if (!activeLetter) return;
                const x = event.clientX + 12;
                const y = event.clientY + 12;
                dragGhost.style.transform = `translate(${x}px, ${y}px)`;
            });
        }

        renderSentence();
    }

    // Navigation
    prevBtn.addEventListener("click", () => {
        const phases = [PHASES.SOUNDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);
        if (currentIndex > 0) {
            state.currentPhase = phases[currentIndex - 1];
            state.currentActivity = 0;
            saveProgress();
            loadActivity();
            requestActivityFullscreen();
        }
    });

    nextBtn.addEventListener("click", () => {
        const phases = [PHASES.SOUNDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);

        // Within same phase, go to next activity
        if (state.currentPhase === PHASES.WORDS) {
            state.currentActivity++;
            saveProgress();
            loadActivity();
            requestActivityFullscreen();
        } else if (currentIndex < phases.length - 1 && canUnlockPhase(phases[currentIndex + 1])) {
            state.currentPhase = phases[currentIndex + 1];
            state.currentActivity = 0;
            saveProgress();
            loadActivity();
            requestActivityFullscreen();
        } else if (state.currentPhase === PHASES.SENTENCES) {
            state.currentActivity++;
            saveProgress();
            loadActivity();
            requestActivityFullscreen();
        }
    });

    resetBtn.addEventListener("click", resetProgress);

    langButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            setLanguage(btn.dataset.lang);
        });
    });

    activityCard.addEventListener("contextmenu", (event) => {
        event.preventDefault();
    });

    fullscreenExitBtn.addEventListener("click", () => {
        exitActivityFullscreen();
    });

    fullscreenEnterBtn.addEventListener("click", () => {
        requestActivityFullscreen();
    });

    // Phase item clicks
    document.querySelectorAll(".phase-item").forEach(item => {
        item.addEventListener("click", () => {
            const phase = item.dataset.phase;
            if (!item.classList.contains("locked") || canUnlockPhase(phase)) {
                state.currentPhase = phase;
                state.currentActivity = 0;
                saveProgress();
                loadActivity();
                requestActivityFullscreen();
            } else {
                showToast(t("toast.unlockMore"), "info");
            }
        });
    });

    // Initialize
    function init() {
        // Load voices for Web Speech API
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => {
                AudioSystem.synth.getVoices();
            };
        }

        loadProgress();
        applyTranslations();
        updateLanguageButtons();
        drawCharacter();
        loadActivity();

        showToast(t("toast.welcome"), "success");
    }

    init();
});
