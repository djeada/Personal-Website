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
        BLENDS: "blends",
        WORDS: "words",
        SENTENCES: "sentences"
    };

    const TRANSLATIONS = {
        en: {
            "header.title": "Phonics Adventure",
            "header.subtitle": "Learn to read through sounds, words, and stories! Tap letters to hear sounds, build words, and follow along with fun stories.",
            "phase.sounds": "Sounds",
            "phase.blends": "Blends",
            "phase.words": "Words",
            "phase.stories": "Stories",
            "stats.stars": "Stars",
            "stats.sounds": "Sounds",
            "stats.words": "Words",
            "stats.stories": "Stories",
            "loading": "Loading activities...",
            "nav.back": "Back",
            "nav.next": "Next",
            "help.title": "👨‍👩‍👧 Parent Info",
            "help.currentPhaseLabel": "Current Phase:",
            "help.progressLabel": "Progress:",
            "help.phaseInfo": "Children progress through phases: Sounds → Blends → Words → Stories",
            "help.masteryInfo": "Each phase must be mastered before moving on",
            "help.autoSaveInfo": "Progress is saved automatically in this browser",
            "help.audioHint": "Tap the 🔊 button to hear sounds and words",
            "help.resetHint": "Use the Reset button below to start over",
            "help.resetButton": "🔄 Reset Progress",
            "activity.soundsTitle": "Letter Sounds",
            "activity.blendsTitle": "Sound Blending",
            "activity.wordsTitle": "Word Building",
            "activity.storiesTitle": "Story Time",
            "sounds.prompt": "Listen to each face, then connect the right sound!",
            "sounds.instructions": "Tap each face to hear its sound, then drag from the letter to the correct face.",
            "sounds.letterTitle": "Letter",
            "sounds.dragToFace": "Drag to a face!",
            "sounds.matchToast": "You matched \"{letter}\"!",
            "sounds.matchAgain": "Nice! \"{letter}\" again.",
            "sounds.tryAnotherFace": "Try another face!",
            "blends.prompt": "Let's blend sounds to make: {word}",
            "blends.speak": "Let's blend the sounds together!",
            "blends.listenLabel": "Listen and blend!",
            "blends.tapHint": "Tap each sound, then tap 🔊 to hear the whole word!",
            "words.prompt": "Build the word: {word}",
            "words.speak": "Can you build the word {word}?",
            "words.buildLabel": "Build:",
            "words.builtToast": "You built \"{word}\"!",
            "words.tryAnotherLetter": "Try another letter!",
            "stories.prompt": "Let's read a story together!",
            "stories.speak": "Let's read a story together!",
            "stories.readButton": "Read Story",
            "stories.greatReading": "Great reading!",
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
            "phase.sounds": "Laute",
            "phase.blends": "Mischen",
            "phase.words": "Wörter",
            "phase.stories": "Geschichten",
            "stats.stars": "Sterne",
            "stats.sounds": "Laute",
            "stats.words": "Wörter",
            "stats.stories": "Geschichten",
            "loading": "Aktivitäten werden geladen...",
            "nav.back": "Zurück",
            "nav.next": "Weiter",
            "help.title": "👨‍👩‍👧 Elterninfo",
            "help.currentPhaseLabel": "Aktuelle Phase:",
            "help.progressLabel": "Fortschritt:",
            "help.phaseInfo": "Kinder durchlaufen Phasen: Laute → Mischen → Wörter → Geschichten",
            "help.masteryInfo": "Jede Phase muss gemeistert werden, bevor es weitergeht",
            "help.autoSaveInfo": "Fortschritt wird automatisch in diesem Browser gespeichert",
            "help.audioHint": "Tippe auf 🔊, um Laute und Wörter zu hören",
            "help.resetHint": "Nutze den Reset-Button unten, um neu zu starten",
            "help.resetButton": "🔄 Fortschritt zurücksetzen",
            "activity.soundsTitle": "Buchstabenlaute",
            "activity.blendsTitle": "Laute mischen",
            "activity.wordsTitle": "Wörter bauen",
            "activity.storiesTitle": "Geschichtenzeit",
            "sounds.prompt": "Höre dir jedes Gesicht an und verbinde den richtigen Laut!",
            "sounds.instructions": "Tippe jedes Gesicht an, höre den Laut und ziehe den Buchstaben zum richtigen Gesicht.",
            "sounds.letterTitle": "Buchstabe",
            "sounds.dragToFace": "Ziehe zu einem Gesicht!",
            "sounds.matchToast": "Du hast \"{letter}\" verbunden!",
            "sounds.matchAgain": "Super! \"{letter}\" nochmal.",
            "sounds.tryAnotherFace": "Versuch ein anderes Gesicht!",
            "blends.prompt": "Lass uns Laute mischen für: {word}",
            "blends.speak": "Lass uns die Laute zusammenmischen!",
            "blends.listenLabel": "Hör zu und mische!",
            "blends.tapHint": "Tippe jeden Laut an und dann 🔊, um das ganze Wort zu hören!",
            "words.prompt": "Baue das Wort: {word}",
            "words.speak": "Kannst du das Wort {word} bauen?",
            "words.buildLabel": "Baue:",
            "words.builtToast": "Du hast \"{word}\" gebaut!",
            "words.tryAnotherLetter": "Versuch einen anderen Buchstaben!",
            "stories.prompt": "Lass uns zusammen eine Geschichte lesen!",
            "stories.speak": "Lass uns zusammen eine Geschichte lesen!",
            "stories.readButton": "Geschichte vorlesen",
            "stories.greatReading": "Super gelesen!",
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

    // CVC words for blending and word building
    const CVC_WORDS = [
        { word: "cat", sounds: ["c", "a", "t"] },
        { word: "dog", sounds: ["d", "o", "g"] },
        { word: "sun", sounds: ["s", "u", "n"] },
        { word: "hat", sounds: ["h", "a", "t"] },
        { word: "bed", sounds: ["b", "e", "d"] },
        { word: "pig", sounds: ["p", "i", "g"] },
        { word: "cup", sounds: ["c", "u", "p"] },
        { word: "map", sounds: ["m", "a", "p"] },
        { word: "net", sounds: ["n", "e", "t"] },
        { word: "fox", sounds: ["f", "o", "x"] },
        { word: "bug", sounds: ["b", "u", "g"] },
        { word: "red", sounds: ["r", "e", "d"] },
        { word: "hen", sounds: ["h", "e", "n"] },
        { word: "jam", sounds: ["j", "a", "m"] },
        { word: "leg", sounds: ["l", "e", "g"] }
    ];

    // Simple stories using only learned CVC words
    const STORIES = [
        {
            title: "The Cat",
            text: "The cat sat on a mat. The cat is fat. The cat can nap.",
            words: ["the", "cat", "sat", "on", "a", "mat", "is", "fat", "can", "nap"]
        },
        {
            title: "The Dog",
            text: "The dog ran to the log. The dog dug in the mud. The dog is fun.",
            words: ["the", "dog", "ran", "to", "log", "dug", "in", "mud", "is", "fun"]
        },
        {
            title: "The Sun",
            text: "The sun is hot. The sun is up. I run in the sun. It is fun.",
            words: ["the", "sun", "is", "hot", "up", "i", "run", "in", "it", "fun"]
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
        phaseProgress: {
            sounds: 0,
            blends: 0,
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
        ctx.fillStyle = characterState.mouthOpen ? "#FF6B6B" : "#FF8E8E";
        ctx.beginPath();
        if (characterState.mouthOpen) {
            ctx.ellipse(100, 130, 25, 20, 0, 0, Math.PI * 2);
        } else {
            ctx.ellipse(100, 130, 30, 10, 0, 0, Math.PI);
        }
        ctx.fill();
        ctx.strokeStyle = "#E85555";
        ctx.lineWidth = 2;
        ctx.stroke();

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
                phaseProgress: {
                    sounds: 0,
                    blends: 0,
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
        const phases = [PHASES.SOUNDS, PHASES.BLENDS, PHASES.WORDS, PHASES.SENTENCES];
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
            blends: t("activity.blendsTitle"),
            words: t("activity.wordsTitle"),
            sentences: t("activity.storiesTitle")
        };
        parentPhase.textContent = phaseNames[state.currentPhase];

        const totalProgress = calculateTotalProgress();
        parentProgress.textContent = totalProgress + "%";
    }

    function calculateTotalProgress() {
        const soundProgress = (state.masteredSounds.length / LETTERS.length) * 25;
        const wordProgress = (state.masteredWords.length / CVC_WORDS.length) * 50;
        const storyProgress = (state.completedStories.length / STORIES.length) * 25;
        return Math.round(soundProgress + wordProgress + storyProgress);
    }

    function canUnlockPhase(phase) {
        return true;
    }

    function checkPhaseProgression() {
        const phases = [PHASES.SOUNDS, PHASES.BLENDS, PHASES.WORDS, PHASES.SENTENCES];
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
            case PHASES.BLENDS:
                renderBlendsActivity();
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

    function updateNavigationButtons() {
        const phases = [PHASES.SOUNDS, PHASES.BLENDS, PHASES.WORDS, PHASES.SENTENCES];
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

            if (letter === target.letter) {
                locked = true;
                targetButton.classList.add("matched");
                letterCard.classList.add("matched");
                dragLine.classList.add("visible");
                setDragLine(getLetterCenter(), getButtonCenter(targetButton));

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

    // Blends activity
    function renderBlendsActivity() {
        activityIcon.textContent = "🔗";
        activityTitle.textContent = t("activity.blendsTitle");

        const wordIndex = state.currentActivity % CVC_WORDS.length;
        const wordData = CVC_WORDS[wordIndex];

        showCharacterSpeech(t("blends.prompt", { word: wordData.word }));
        AudioSystem.speak(t("blends.speak"));

        let html = `
            <div class="word-builder">
                <div class="target-word">
                    <button class="sound-btn" id="play-word-btn">🔊</button>
                    ${t("blends.listenLabel")}
                </div>
                <div class="word-slots" id="word-slots">
                    ${wordData.sounds.map((s, i) => `
                        <div class="word-slot" data-index="${i}" data-sound="${s}">
                            <button class="sound-btn" style="font-size: 1.2rem; width: 40px; height: 40px;">🔊</button>
                        </div>
                    `).join("")}
                </div>
                <p style="font-size: 1.2rem; color: var(--text-secondary); margin-top: 20px;">
                    ${t("blends.tapHint")}
                </p>
            </div>
        `;

        activityArea.innerHTML = html;

        // Play word button
        document.getElementById("play-word-btn").addEventListener("click", () => {
            AudioSystem.speakWord(wordData.word, true);
        });

        // Individual sound buttons
        document.querySelectorAll(".word-slot .sound-btn").forEach((btn, index) => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                AudioSystem.speakLetter(wordData.sounds[index]);
            });
        });

        // Auto-play on load
        setTimeout(() => {
            AudioSystem.speakWord(wordData.word, true);
        }, 500);
    }

    // Words activity (word building)
    function renderWordsActivity() {
        activityIcon.textContent = "📝";
        activityTitle.textContent = t("activity.wordsTitle");

        const wordIndex = state.currentActivity % CVC_WORDS.length;
        const wordData = CVC_WORDS[wordIndex];

        showCharacterSpeech(t("words.prompt", { word: wordData.word }));
        AudioSystem.speak(t("words.speak", { word: wordData.word }));

        // Shuffle letters for choices
        const extraLetters = ["x", "z", "q", "k"];
        const choices = [...wordData.sounds];
        while (choices.length < 6) {
            const extra = extraLetters[Math.floor(Math.random() * extraLetters.length)];
            if (!choices.includes(extra)) {
                choices.push(extra);
            }
        }
        const shuffledChoices = shuffleArray(choices);

        let html = `
            <div class="word-builder">
                <div class="target-word">
                    <button class="sound-btn" id="play-target-btn">🔊</button>
                    ${t("words.buildLabel")} <strong>${wordData.word.toUpperCase()}</strong>
                </div>
                <div class="word-slots" id="word-slots">
                    ${wordData.sounds.map((_, i) => `
                        <div class="word-slot" data-index="${i}"></div>
                    `).join("")}
                </div>
                <div class="letter-choices" id="letter-choices">
                    ${shuffledChoices.map(letter => `
                        <button class="choice-btn" data-letter="${letter}">${letter.toUpperCase()}</button>
                    `).join("")}
                </div>
            </div>
        `;

        activityArea.innerHTML = html;

        let currentSlot = 0;
        const slots = document.querySelectorAll(".word-slot");
        const choiceBtns = document.querySelectorAll(".choice-btn");

        // Play target word
        document.getElementById("play-target-btn").addEventListener("click", () => {
            AudioSystem.speakWord(wordData.word);
        });

        // Letter choice handlers
        choiceBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                if (currentSlot >= wordData.sounds.length || btn.classList.contains("used")) return;

                const letter = btn.dataset.letter;
                const expectedLetter = wordData.sounds[currentSlot];

                if (letter === expectedLetter) {
                    slots[currentSlot].textContent = letter.toUpperCase();
                    slots[currentSlot].classList.add("filled", "correct");
                    btn.classList.add("used");
                    AudioSystem.speakLetter(letter);
                    currentSlot++;

                    if (currentSlot === wordData.sounds.length) {
                        // Word complete!
                        setTimeout(() => {
                            if (!state.masteredWords.includes(wordData.word)) {
                                state.masteredWords.push(wordData.word);
                                state.stars += 5;
                                saveProgress();
                            }
                            showToast(t("words.builtToast", { word: wordData.word }), "success");
                            celebrate();
                            AudioSystem.speakEncouragement();
                            checkPhaseProgression();
                        }, 500);
                    }
                } else {
                    btn.style.animation = "shake 0.3s ease";
                    setTimeout(() => btn.style.animation = "", 300);
                    showToast(t("words.tryAnotherLetter"), "info");
                }
            });
        });

        // Auto-play on load
        setTimeout(() => {
            AudioSystem.speakWord(wordData.word);
        }, 500);
    }

    // Stories activity
    function renderStoriesActivity() {
        activityIcon.textContent = "📖";
        activityTitle.textContent = t("activity.storiesTitle");

        const storyIndex = state.currentActivity % STORIES.length;
        const story = STORIES[storyIndex];

        showCharacterSpeech(t("stories.prompt"));
        AudioSystem.speak(t("stories.speak"));

        // Create word spans for each word
        const wordsHtml = story.text.split(/\s+/).map((word, i) => {
            const cleanWord = word.replace(/[.,!?]/g, "").toLowerCase();
            return `<span class="story-word" data-word="${cleanWord}" data-index="${i}">${word} </span>`;
        }).join("");

        let html = `
            <div class="story-container">
                <h3 class="story-title">📖 ${story.title}</h3>
                <div class="story-text" id="story-text">
                    ${wordsHtml}
                </div>
                <div class="story-controls">
                    <button class="nav-btn primary" id="read-story-btn">
                        <span class="btn-icon">🔊</span>
                        <span class="btn-text">${t("stories.readButton")}</span>
                    </button>
                </div>
            </div>
        `;

        activityArea.innerHTML = html;

        // Word tap to hear
        document.querySelectorAll(".story-word").forEach(span => {
            span.addEventListener("click", () => {
                const word = span.dataset.word;
                AudioSystem.speakWord(word);
                span.classList.add("highlighted");
                setTimeout(() => span.classList.remove("highlighted"), 500);
            });
        });

        // Read full story
        document.getElementById("read-story-btn").addEventListener("click", () => {
            const words = document.querySelectorAll(".story-word");
            let wordIndex = 0;

            function highlightNext() {
                if (wordIndex > 0) {
                    words[wordIndex - 1].classList.remove("highlighted");
                }

                if (wordIndex < words.length) {
                    words[wordIndex].classList.add("highlighted");
                    const word = words[wordIndex].dataset.word;
                    AudioSystem.speakWord(word);
                    wordIndex++;
                    setTimeout(highlightNext, 800);
                } else {
                    // Story complete
                    if (!state.completedStories.includes(story.title)) {
                        state.completedStories.push(story.title);
                        state.stars += 10;
                        saveProgress();
                    }
                    showToast(t("stories.greatReading"), "success");
                    celebrate();
                    AudioSystem.speakEncouragement();
                }
            }

            highlightNext();
        });
    }

    // Navigation
    prevBtn.addEventListener("click", () => {
        const phases = [PHASES.SOUNDS, PHASES.BLENDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);
        if (currentIndex > 0) {
            state.currentPhase = phases[currentIndex - 1];
            state.currentActivity = 0;
            saveProgress();
            loadActivity();
        }
    });

    nextBtn.addEventListener("click", () => {
        const phases = [PHASES.SOUNDS, PHASES.BLENDS, PHASES.WORDS, PHASES.SENTENCES];
        const currentIndex = phases.indexOf(state.currentPhase);

        // Within same phase, go to next activity
        if (state.currentPhase === PHASES.BLENDS || state.currentPhase === PHASES.WORDS) {
            state.currentActivity++;
            saveProgress();
            loadActivity();
        } else if (currentIndex < phases.length - 1 && canUnlockPhase(phases[currentIndex + 1])) {
            state.currentPhase = phases[currentIndex + 1];
            state.currentActivity = 0;
            saveProgress();
            loadActivity();
        } else if (state.currentPhase === PHASES.SENTENCES) {
            state.currentActivity++;
            saveProgress();
            loadActivity();
        }
    });

    resetBtn.addEventListener("click", resetProgress);

    langButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            setLanguage(btn.dataset.lang);
        });
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
