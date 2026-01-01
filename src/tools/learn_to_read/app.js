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
    const achievementsBadges = document.querySelectorAll(".achievement-badge");
    const streakIndicator = document.getElementById("streak-indicator");
    const streakText = document.getElementById("streak-text");

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

    // Achievement definitions
    const ACHIEVEMENTS = {
        "first-letter": {
            condition: (s) => s.masteredSounds.length >= 1,
            labelKey: "achievement.firstLetter.label",
            titleKey: "achievement.firstLetter.title"
        },
        "letter-master": {
            condition: (s) => s.masteredSounds.length >= 10,
            labelKey: "achievement.letterMaster.label",
            titleKey: "achievement.letterMaster.title"
        },
        "word-builder": {
            condition: (s) => s.masteredWords.length >= 5,
            labelKey: "achievement.wordBuilder.label",
            titleKey: "achievement.wordBuilder.title"
        },
        "story-reader": {
            condition: (s) => s.completedStories.length >= 1,
            labelKey: "achievement.storyReader.label",
            titleKey: "achievement.storyReader.title"
        },
        "superstar": {
            condition: (s) => s.stars >= 50,
            labelKey: "achievement.superstar.label",
            titleKey: "achievement.superstar.title"
        }
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
            "sounds.instructions": "Tap each face to hear its sound, then connect the letter and face from either side.",
            "sounds.letterTitle": "Letter",
            "sounds.dragToFace": "Drag to a face!",
            "sounds.dragToLetter": "Drag to the letter!",
            "sounds.matchToast": "You matched \"{letter}\"! ⭐",
            "sounds.matchAgain": "Nice! \"{letter}\" again. 🌟",
            "sounds.tryAnotherFace": "Try another face!",
            "words.prompt": "Listen to the sound and build the word.",
            "words.speak": "Listen carefully.",
            "words.instructions": "Drag the letters into the boxes to match the sound.",
            "words.tryAgain": "Try again!",
            "words.builtToast": "You built \"{word}\"! 🎉",
            "stories.prompt": "Let's read a story together!",
            "stories.speak": "Let's read a story together!",
            "stories.readButton": "🔊 Read Story",
            "stories.greatReading": "Great reading! 📚",
            "stories.instructions": "Fill the missing word to continue the story.",
            "confirm.reset": "Are you sure you want to reset all progress?",
            "toast.saveFail": "Could not save progress",
            "toast.reset": "Progress reset!",
            "toast.newPhase": "🎊 New phase unlocked!",
            "toast.unlockSpeak": "Great job! You unlocked a new level!",
            "toast.unlockMore": "Complete more activities to unlock!",
            "toast.welcome": "Welcome to Phonics Adventure! 🎈",
            "toast.achievement": "🏆 Achievement Unlocked: {name}!",
            "streak.day": "Day {count} Streak! 🔥",
            "achievement.firstLetter.label": "First Letter",
            "achievement.firstLetter.title": "First Letter Mastered",
            "achievement.letterMaster.label": "Letter Master",
            "achievement.letterMaster.title": "Master 10 Letters",
            "achievement.wordBuilder.label": "Word Builder",
            "achievement.wordBuilder.title": "Build 5 Words",
            "achievement.storyReader.label": "Story Reader",
            "achievement.storyReader.title": "Complete a Story",
            "achievement.superstar.label": "Superstar",
            "achievement.superstar.title": "Earn 50 Stars"
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
            "sounds.instructions": "Tippe jedes Gesicht an, höre den Laut und verbinde Buchstabe und Gesicht von beiden Seiten.",
            "sounds.letterTitle": "Buchstabe",
            "sounds.dragToFace": "Ziehe zu einem Gesicht!",
            "sounds.dragToLetter": "Ziehe zum Buchstaben!",
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
            "stories.readButton": "🔊 Geschichte vorlesen",
            "stories.greatReading": "Super gelesen! 📚",
            "stories.instructions": "Setze das fehlende Wort ein, um weiterzulesen.",
            "confirm.reset": "Möchtest du den gesamten Fortschritt wirklich zurücksetzen?",
            "toast.saveFail": "Fortschritt konnte nicht gespeichert werden",
            "toast.reset": "Fortschritt zurückgesetzt!",
            "toast.newPhase": "🎊 Neue Phase freigeschaltet!",
            "toast.unlockSpeak": "Super gemacht! Du hast ein neues Level freigeschaltet!",
            "toast.unlockMore": "Mache mehr Aktivitäten, um freizuschalten!",
            "toast.welcome": "Willkommen im Lese-Abenteuer! 🎈",
            "toast.achievement": "🏆 Erfolg freigeschaltet: {name}!",
            "streak.day": "Tag {count} in Folge! 🔥",
            "achievement.firstLetter.label": "Erster Buchstabe",
            "achievement.firstLetter.title": "Ersten Buchstaben gemeistert",
            "achievement.letterMaster.label": "Buchstaben-Meister",
            "achievement.letterMaster.title": "10 Buchstaben meistern",
            "achievement.wordBuilder.label": "Wort-Baumeister",
            "achievement.wordBuilder.title": "5 Wörter bauen",
            "achievement.storyReader.label": "Geschichtenleser",
            "achievement.storyReader.title": "Eine Geschichte abschließen",
            "achievement.superstar.label": "Superstar",
            "achievement.superstar.title": "50 Sterne verdienen"
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
            "Great job! 🌟",
            "You did it! 🎉",
            "Wonderful! ✨",
            "Amazing! 🏆",
            "Keep going! 💪",
            "You're a star! ⭐",
            "Fantastic! 🚀",
            "Well done! 👏",
            "Super! 🦸",
            "Brilliant! 💎"
        ],
        de: [
            "Toll gemacht! 🌟",
            "Du hast es geschafft! 🎉",
            "Wunderbar! ✨",
            "Großartig! 🏆",
            "Mach weiter so! 💪",
            "Du bist ein Star! ⭐",
            "Fantastisch! 🚀",
            "Super gemacht! 👏",
            "Klasse! 🦸",
            "Brillant! 💎"
        ]
    };

    // Letter data with phonics sounds and emojis
    const LETTERS = [
        { letter: "A", sound: "a", example: { en: "apple", de: "apfel" }, emoji: { en: "🍎", de: "🍎" } },
        { letter: "B", sound: "b", example: { en: "ball", de: "ball" }, emoji: { en: "⚽", de: "⚽" } },
        { letter: "C", sound: "k", example: { en: "cat", de: "clown" }, emoji: { en: "🐱", de: "🤡" } },
        { letter: "D", sound: "d", example: { en: "dog", de: "drache" }, emoji: { en: "🐕", de: "🐉" } },
        { letter: "E", sound: "e", example: { en: "egg", de: "ente" }, emoji: { en: "🥚", de: "🦆" } },
        { letter: "F", sound: "f", example: { en: "fish", de: "fisch" }, emoji: { en: "🐟", de: "🐟" } },
        { letter: "G", sound: "g", example: { en: "goat", de: "giraffe" }, emoji: { en: "🐐", de: "🦒" } },
        { letter: "H", sound: "h", example: { en: "hat", de: "haus" }, emoji: { en: "🎩", de: "🏠" } },
        { letter: "I", sound: "i", example: { en: "igloo", de: "iglu" }, emoji: { en: "🏠", de: "🧊" } },
        { letter: "J", sound: "j", example: { en: "jam", de: "joghurt" }, emoji: { en: "🍓", de: "🥣" } },
        { letter: "K", sound: "k", example: { en: "kite", de: "katze" }, emoji: { en: "🪁", de: "🐱" } },
        { letter: "L", sound: "l", example: { en: "lion", de: "loewe" }, emoji: { en: "🦁", de: "🦁" } },
        { letter: "M", sound: "m", example: { en: "mouse", de: "maus" }, emoji: { en: "🐭", de: "🐭" } },
        { letter: "N", sound: "n", example: { en: "nest", de: "nest" }, emoji: { en: "🪺", de: "🪺" } },
        { letter: "O", sound: "o", example: { en: "octopus", de: "oktopus" }, emoji: { en: "🐙", de: "🐙" } },
        { letter: "P", sound: "p", example: { en: "pig", de: "pferd" }, emoji: { en: "🐷", de: "🐴" } },
        { letter: "Q", sound: "q", example: { en: "queen", de: "qualle" }, emoji: { en: "👸", de: "🪼" } },
        { letter: "R", sound: "r", example: { en: "rabbit", de: "regen" }, emoji: { en: "🐰", de: "🌧️" } },
        { letter: "S", sound: "s", example: { en: "sun", de: "sonne" }, emoji: { en: "☀️", de: "☀️" } },
        { letter: "T", sound: "t", example: { en: "turtle", de: "tiger" }, emoji: { en: "🐢", de: "🐯" } },
        { letter: "U", sound: "u", example: { en: "umbrella", de: "uhr" }, emoji: { en: "☂️", de: "⏰" } },
        { letter: "V", sound: "v", example: { en: "van", de: "vogel" }, emoji: { en: "🚐", de: "🐦" } },
        { letter: "W", sound: "w", example: { en: "whale", de: "wolke" }, emoji: { en: "🐋", de: "☁️" } },
        { letter: "X", sound: "x", example: { en: "box", de: "xylophon" }, emoji: { en: "📦", de: "🎼" } },
        { letter: "Y", sound: "y", example: { en: "yellow", de: "yoga" }, emoji: { en: "💛", de: "🧘" } },
        { letter: "Z", sound: "z", example: { en: "zebra", de: "zebra" }, emoji: { en: "🦓", de: "🦓" } }
    ];

    function getLetterExample(letterData) {
        if (letterData.example && typeof letterData.example === "object") {
            return letterData.example[state.language] || letterData.example.en || "";
        }
        return letterData.example || "";
    }

    function getLetterEmoji(letterData) {
        if (letterData.emoji && typeof letterData.emoji === "object") {
            return letterData.emoji[state.language] || letterData.emoji.en || "";
        }
        return letterData.emoji || "";
    }

    // Categorized words for more engaging learning
    const WORD_CATEGORIES = {
        animals: ["cat", "dog", "pig", "hen", "cow", "fox", "bat", "bee", "ant", "owl", "rat", "ram"],
        colors: ["red", "tan", "sky"],
        food: ["egg", "jam", "pie", "tea", "ham", "fig", "nut", "bun", "pea"],
        nature: ["sun", "sky", "sea", "mud", "fog", "bay", "oak", "elm", "ash"],
        body: ["arm", "leg", "ear", "eye", "lip", "toe", "jaw", "hip", "rib"],
        objects: ["hat", "box", "cup", "bag", "bed", "pen", "pot", "pan", "key", "jar", "can", "mop", "net", "rug"]
    };

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

    const SHORT_WORDS_DE = [
        "am", "an", "auf", "aus", "bei", "bin", "bis", "das", "der", "die",
        "du", "ein", "er", "es", "ganz", "gut", "hat", "ich", "im", "in",
        "ist", "ja", "mit", "nur", "ohne", "sie", "so", "und", "wie", "wir",
        "zu", "oma", "opa", "mama", "papa", "haus", "maus", "baum", "ball",
        "boot", "brot", "hand", "kind", "hund", "katze", "fisch", "vogel",
        "biene", "blume", "sonne", "mond", "stern", "wald", "garten", "kiste",
        "stall", "hof", "trog", "netz", "nass", "warm", "hell", "rot", "rosa",
        "fett", "lieb", "spielt", "rennt", "sitzt", "schlaf", "schlafen",
        "see", "schwein", "huhn", "fuchs", "honig", "fliegen", "schlamm",
        "ei", "spiel", "spiele"
    ];

    const STORIES = [
        {
            title: "The Cat 🐱",
            emoji: "🐱",
            sentences: [
                { text: "The ____ sat on a mat.", missing: "cat" },
                { text: "The cat is ____.", missing: "fat" },
                { text: "The cat can ____.", missing: "nap" }
            ]
        },
        {
            title: "The Dog 🐕",
            emoji: "🐕",
            sentences: [
                { text: "The ____ ran to the log.", missing: "dog" },
                { text: "The dog dug in the ____.", missing: "mud" },
                { text: "The dog is ____.", missing: "fun" }
            ]
        },
        {
            title: "The Sun ☀️",
            emoji: "☀️",
            sentences: [
                { text: "The sun is ____.", missing: "hot" },
                { text: "The sun is ____.", missing: "up" },
                { text: "I run in the ____.", missing: "sun" }
            ]
        },
        {
            title: "The Pig 🐷",
            emoji: "🐷",
            sentences: [
                { text: "The ____ is pink.", missing: "pig" },
                { text: "The pig sat in the ____.", missing: "mud" },
                { text: "The pig ate from a ____.", missing: "cup" }
            ]
        },
        {
            title: "The Fox 🦊",
            emoji: "🦊",
            sentences: [
                { text: "The ____ ran in the woods.", missing: "fox" },
                { text: "The fox is ____.", missing: "red" },
                { text: "The fox hid in a ____.", missing: "box" }
            ]
        },
        {
            title: "The Hen 🐔",
            emoji: "🐔",
            sentences: [
                { text: "The ____ sat on ten eggs.", missing: "hen" },
                { text: "The hen ate from a ____.", missing: "pan" },
                { text: "The hen ran to her ____.", missing: "pen" }
            ]
        },
        {
            title: "The Bee 🐝",
            emoji: "🐝",
            sentences: [
                { text: "The ____ can fly.", missing: "bee" },
                { text: "The bee sat on a ____.", missing: "bud" },
                { text: "The bee is on the ____.", missing: "log" }
            ]
        },
        {
            title: "The Fish 🐟",
            emoji: "🐟",
            sentences: [
                { text: "The ____ swims in the sea.", missing: "fish" },
                { text: "The fish is ____.", missing: "wet" },
                { text: "The fish hid by the ____.", missing: "net" }
            ]
        }
    ];

    const STORIES_DE = [
        {
            title: "Die Katze 🐱",
            emoji: "🐱",
            sentences: [
                { text: "Die ____ sitzt auf der Matte.", missing: "katze" },
                { text: "Die katze ist ____.", missing: "fett" },
                { text: "Die katze kann ____.", missing: "schlafen" }
            ]
        },
        {
            title: "Der Hund 🐕",
            emoji: "🐕",
            sentences: [
                { text: "Der ____ rennt zum Baum.", missing: "hund" },
                { text: "Der hund spielt im ____.", missing: "garten" },
                { text: "Der hund ist ____.", missing: "lieb" }
            ]
        },
        {
            title: "Die Sonne ☀️",
            emoji: "☀️",
            sentences: [
                { text: "Die ____ ist hell.", missing: "sonne" },
                { text: "Die sonne ist ____.", missing: "warm" },
                { text: "Ich spiele in der ____.", missing: "sonne" }
            ]
        },
        {
            title: "Das Schwein 🐷",
            emoji: "🐷",
            sentences: [
                { text: "Das ____ ist rosa.", missing: "schwein" },
                { text: "Das schwein rollt im ____.", missing: "schlamm" },
                { text: "Das schwein isst aus dem ____.", missing: "trog" }
            ]
        },
        {
            title: "Der Fuchs 🦊",
            emoji: "🦊",
            sentences: [
                { text: "Der ____ rennt im Wald.", missing: "fuchs" },
                { text: "Der fuchs ist ____.", missing: "rot" },
                { text: "Der fuchs sitzt auf der ____.", missing: "kiste" }
            ]
        },
        {
            title: "Das Huhn 🐔",
            emoji: "🐔",
            sentences: [
                { text: "Das ____ sitzt auf dem Ei.", missing: "huhn" },
                { text: "Das huhn rennt zum ____.", missing: "stall" },
                { text: "Das huhn pickt im ____.", missing: "hof" }
            ]
        },
        {
            title: "Die Biene 🐝",
            emoji: "🐝",
            sentences: [
                { text: "Die ____ kann fliegen.", missing: "biene" },
                { text: "Die biene sitzt auf der ____.", missing: "blume" },
                { text: "Die biene macht ____.", missing: "honig" }
            ]
        },
        {
            title: "Der Fisch 🐟",
            emoji: "🐟",
            sentences: [
                { text: "Der ____ schwimmt im See.", missing: "fisch" },
                { text: "Der fisch ist ____.", missing: "nass" },
                { text: "Der fisch schwimmt im ____.", missing: "netz" }
            ]
        }
    ];

    function getShortWords() {
        return state.language === "de" ? SHORT_WORDS_DE : SHORT_WORDS;
    }

    function getStories() {
        return state.language === "de" ? STORIES_DE : STORIES;
    }

    // Progress state
    let state = {
        currentPhase: PHASES.SOUNDS,
        currentActivity: 0,
        stars: 0,
        masteredSounds: [],
        masteredWords: [],
        completedStories: [],
        language: "en",
        streak: 0,
        lastPlayDate: null,
        achievements: [],
        activityStats: {
            sounds: { attempts: 0, correct: 0 },
            words: { attempts: 0, correct: 0 },
            stories: { attempts: 0, correct: 0 }
        },
        lastSoundIndex: null,
        phaseProgress: {
            sounds: 0,
            words: 0,
            sentences: 0
        }
    };

    function stripEmojis(text) {
        return text
            .replace(/[\p{Extended_Pictographic}\u200d\uFE0F]/gu, "")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    function clampNumber(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function getPreferredVoice(utteranceLang) {
        if (!AudioSystem.synth) return null;
        const voices = AudioSystem.synth.getVoices();
        if (!voices.length) return null;

        const langPrefix = utteranceLang.split("-")[0];
        const preferredNames = {
            de: [
                "Google Deutsch",
                "Google Deutsch Female",
                "Microsoft Katja",
                "Microsoft Hedda",
                "Anna",
                "Helena",
                "Yannick"
            ],
            en: [
                "Google US English",
                "Google UK English Female",
                "Microsoft Aria",
                "Microsoft Jenny",
                "Samantha",
                "Alex"
            ]
        };

        const preferredList = preferredNames[langPrefix] || [];
        const byName = preferredList.map((name) => (
            voices.find((voice) => voice.name === name || voice.name.includes(name))
        )).find(Boolean);
        if (byName) return byName;

        return voices.find((voice) => voice.lang.startsWith(langPrefix) && voice.default)
            || voices.find((voice) => voice.lang.startsWith(langPrefix))
            || null;
    }

    function adjustProsody(rate, pitch, utteranceLang) {
        const langPrefix = utteranceLang.split("-")[0];
        if (langPrefix === "de") {
            return {
                rate: clampNumber(rate * 0.95, 0.6, 1.05),
                pitch: clampNumber(pitch * 0.9, 0.8, 1.15)
            };
        }
        return { rate, pitch };
    }

    // Audio system using Web Speech API with feature detection
    const AudioSystem = {
        synth: typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis : null,
        speaking: false,
        supported: typeof window !== 'undefined' && 'speechSynthesis' in window,

        speak(text, rate = 0.8, pitch = 1.2, langOverride = "") {
            if (!this.supported || !this.synth) {
                console.warn('Web Speech API not supported');
                return;
            }

            if (this.synth.speaking) {
                this.synth.cancel();
            }

            const utteranceText = stripEmojis(text);
            if (!utteranceText) {
                return;
            }

            const utteranceLang = langOverride || (state.language === "de" ? "de-DE" : "en-US");
            const tuned = adjustProsody(rate, pitch, utteranceLang);
            const utterance = new SpeechSynthesisUtterance(utteranceText);
            utterance.rate = tuned.rate;
            utterance.pitch = tuned.pitch;
            utterance.volume = 1;
            utterance.lang = utteranceLang;

            // Try to use a child-friendly voice with robust detection
            const preferredVoice = getPreferredVoice(utteranceLang);
            if (preferredVoice) utterance.voice = preferredVoice;

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

        // Body gradient fill
        const gradient = ctx.createRadialGradient(80, 80, 20, 100, 100, 80);
        gradient.addColorStop(0, "#FFE66D");
        gradient.addColorStop(0.5, "#FFD93D");
        gradient.addColorStop(1, "#F5B700");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(100, 100, 80, 0, Math.PI * 2);
        ctx.fill();

        // Body outline with glow effect
        ctx.strokeStyle = "#E8A800";
        ctx.lineWidth = 4;
        ctx.stroke();

        // Sparkle decorations
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.font = "16px Arial";
        ctx.fillText("✨", 150, 40);
        ctx.fillText("⭐", 30, 50);

        // Eyes
        const eyeY = characterState.eyesBlink ? 75 : 70;
        const eyeHeight = characterState.eyesBlink ? 3 : 22;

        // Left eye
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(70, eyeY, 17, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Left pupil with gradient
        if (!characterState.eyesBlink) {
            const pupilGradient = ctx.createRadialGradient(70, 75, 0, 70, 75, 10);
            pupilGradient.addColorStop(0, "#6366f1");
            pupilGradient.addColorStop(1, "#1e1b4b");
            ctx.fillStyle = pupilGradient;
            ctx.beginPath();
            ctx.arc(70, 75, 9, 0, Math.PI * 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(74, 71, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(67, 79, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Right eye
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.ellipse(130, eyeY, 17, eyeHeight, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Right pupil with gradient
        if (!characterState.eyesBlink) {
            const pupilGradient2 = ctx.createRadialGradient(130, 75, 0, 130, 75, 10);
            pupilGradient2.addColorStop(0, "#6366f1");
            pupilGradient2.addColorStop(1, "#1e1b4b");
            ctx.fillStyle = pupilGradient2;
            ctx.beginPath();
            ctx.arc(130, 75, 9, 0, Math.PI * 2);
            ctx.fill();

            // Eye shine
            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(134, 71, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(127, 79, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Eyebrows
        ctx.strokeStyle = "#8B7355";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(55, 52);
        ctx.quadraticCurveTo(70, 48, 85, 52);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(115, 52);
        ctx.quadraticCurveTo(130, 48, 145, 52);
        ctx.stroke();

        // Mouth
        if (characterState.mouthOpen) {
            // Open mouth with gradient
            const mouthGradient = ctx.createRadialGradient(100, 130, 0, 100, 130, 20);
            mouthGradient.addColorStop(0, "#FF8888");
            mouthGradient.addColorStop(1, "#E85555");
            ctx.fillStyle = mouthGradient;
            ctx.beginPath();
            ctx.ellipse(100, 130, 26, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#C84040";
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Tongue
            ctx.fillStyle = "#FF9999";
            ctx.beginPath();
            ctx.ellipse(100, 138, 12, 8, 0, 0, Math.PI);
            ctx.fill();
        } else {
            // Closed smile
            ctx.strokeStyle = "#E85555";
            ctx.lineWidth = 5;
            ctx.lineCap = "round";
            ctx.beginPath();
            ctx.arc(100, 128, 22, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
        }

        // Cheeks (blush) with gradient
        const blushGradient1 = ctx.createRadialGradient(42, 108, 0, 42, 108, 18);
        blushGradient1.addColorStop(0, "rgba(255, 150, 180, 0.6)");
        blushGradient1.addColorStop(1, "rgba(255, 150, 180, 0)");
        ctx.fillStyle = blushGradient1;
        ctx.beginPath();
        ctx.arc(42, 108, 18, 0, Math.PI * 2);
        ctx.fill();

        const blushGradient2 = ctx.createRadialGradient(158, 108, 0, 158, 108, 18);
        blushGradient2.addColorStop(0, "rgba(255, 150, 180, 0.6)");
        blushGradient2.addColorStop(1, "rgba(255, 150, 180, 0)");
        ctx.fillStyle = blushGradient2;
        ctx.beginPath();
        ctx.arc(158, 108, 18, 0, Math.PI * 2);
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
            warning: "⚠️",
            achievement: "🏆"
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
        `;

        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    // Celebration effect with confetti
    function celebrate(intensity = 1) {
        const celebration = document.createElement("div");
        celebration.className = "celebration";
        document.body.appendChild(celebration);

        const emojis = ["⭐", "🌟", "✨", "🎉", "🎊", "💫", "🌈", "💜", "💖"];
        const count = Math.floor(25 * intensity);
        
        for (let i = 0; i < count; i++) {
            const star = document.createElement("span");
            star.className = "star-burst";
            star.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            star.style.left = Math.random() * 100 + "%";
            star.style.top = Math.random() * 100 + "%";
            star.style.animationDelay = Math.random() * 0.6 + "s";
            star.style.fontSize = (1.5 + Math.random() * 1.5) + "rem";
            celebration.appendChild(star);
        }

        // Add confetti
        const confettiColors = ["#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
        for (let i = 0; i < count; i++) {
            const confetti = document.createElement("div");
            confetti.className = "confetti";
            confetti.style.left = Math.random() * 100 + "%";
            confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
            confetti.style.animationDelay = Math.random() * 1 + "s";
            confetti.style.animationDuration = (2 + Math.random() * 2) + "s";
            celebration.appendChild(confetti);
        }

        setTimeout(() => celebration.remove(), 3500);
    }

    function updateAchievementLabels() {
        achievementsBadges.forEach((badge) => {
            const badgeId = badge.dataset.badge;
            const achievement = ACHIEVEMENTS[badgeId];
            if (!achievement) return;

            const label = badge.querySelector(".badge-label");
            if (label) {
                label.textContent = t(achievement.labelKey);
            }
            badge.title = t(achievement.titleKey);
        });
    }

    // Check and award achievements
    function checkAchievements() {
        const newAchievements = [];
        
        for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
            if (!state.achievements.includes(id) && achievement.condition(state)) {
                state.achievements.push(id);
                newAchievements.push({ id, labelKey: achievement.labelKey });
            }
        }

        if (newAchievements.length > 0) {
            saveProgress();
            updateAchievementBadges();
            
            // Show achievement notifications with delay
            newAchievements.forEach((achievement, index) => {
                setTimeout(() => {
                    showToast(t("toast.achievement", { name: t(achievement.labelKey) }), "achievement");
                    celebrate(1.5);
                }, index * 1500);
            });
        }
    }

    // Update achievement badge display
    function updateAchievementBadges() {
        achievementsBadges.forEach(badge => {
            const badgeId = badge.dataset.badge;
            badge.classList.remove("earned", "locked");
            
            if (state.achievements.includes(badgeId)) {
                badge.classList.add("earned");
            } else {
                badge.classList.add("locked");
            }
        });
    }

    // Check and update daily streak
    function checkStreak() {
        const today = new Date();
        const todayString = today.toDateString();
        const lastPlay = state.lastPlayDate;
        
        if (!lastPlay) {
            // First time playing, start streak at 1
            state.streak = 1;
        } else if (lastPlay === todayString) {
            // Already played today, keep current streak without incrementing
            // This prevents the streak from inflating by multiple plays in one day
        } else {
            // Calculate yesterday's date using UTC to avoid timezone issues
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const yesterdayString = yesterday.toDateString();
            
            if (lastPlay === yesterdayString) {
                // Played yesterday, increment streak
                state.streak += 1;
            } else {
                // Missed a day or more, reset streak to 1
                state.streak = 1;
            }
        }
        
        state.lastPlayDate = todayString;
        saveProgress();
        updateStreakDisplay();
    }

    // Update streak display
    function updateStreakDisplay() {
        if (streakIndicator && streakText) {
            streakText.textContent = t("streak.day", { count: state.streak });
            
            if (state.streak >= 7) {
                streakIndicator.style.background = "linear-gradient(135deg, #fef3c7, #fde68a, #fbbf24)";
            } else if (state.streak >= 3) {
                streakIndicator.style.background = "linear-gradient(135deg, #fef3c7, #fed7aa)";
            }
        }
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
        if (!state.achievements) {
            state.achievements = [];
        }
        if (!state.streak) {
            state.streak = 0;
        }
        if (state.lastSoundIndex === undefined) {
            state.lastSoundIndex = null;
        }
        updateUI();
        updateAchievementBadges();
        updateStreakDisplay();
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
                streak: 0,
                lastPlayDate: null,
                achievements: [],
                activityStats: {
                    sounds: { attempts: 0, correct: 0 },
                    words: { attempts: 0, correct: 0 },
                    stories: { attempts: 0, correct: 0 }
                },
                lastSoundIndex: null,
                phaseProgress: {
                    sounds: 0,
                    words: 0,
                    sentences: 0
                }
            };
            saveProgress();
            loadActivity();
            updateAchievementBadges();
            updateStreakDisplay();
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
        const wordProgress = (state.masteredWords.length / getShortWords().length) * 50;
        const storyProgress = (state.completedStories.length / getStories().length) * 25;
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

    let fallbackFullscreenActive = false;

    function getFullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement;
    }

    function isFullscreenActive() {
        return Boolean(getFullscreenElement()) || fallbackFullscreenActive;
    }

    function preventScroll(event) {
        if (isFullscreenActive()) {
            event.preventDefault();
        }
    }

    const scrollPreventOptions = { passive: false };

    function updateScrollPrevention(enabled) {
        if (enabled) {
            document.addEventListener("wheel", preventScroll, scrollPreventOptions);
            document.addEventListener("touchmove", preventScroll, scrollPreventOptions);
        } else {
            document.removeEventListener("wheel", preventScroll, scrollPreventOptions);
            document.removeEventListener("touchmove", preventScroll, scrollPreventOptions);
        }
    }

    function setFallbackFullscreen(enabled) {
        fallbackFullscreenActive = enabled;
        activityCard.classList.toggle("is-fullscreen", enabled);
        document.body.classList.toggle("activity-fullscreen", enabled);
        updateScrollPrevention(enabled);
    }

    function syncFullscreenState() {
        const nativeFullscreen = Boolean(getFullscreenElement());
        if (nativeFullscreen) {
            document.body.classList.add("activity-fullscreen");
            activityCard.classList.remove("is-fullscreen");
            fallbackFullscreenActive = false;
            updateScrollPrevention(true);
        } else if (!fallbackFullscreenActive) {
            document.body.classList.remove("activity-fullscreen");
            updateScrollPrevention(false);
        }
    }

    function requestActivityFullscreen() {
        if (getFullscreenElement()) {
            return;
        }

        if (activityCard && activityCard.requestFullscreen) {
            const requestResult = activityCard.requestFullscreen();
            if (requestResult && requestResult.catch) {
                requestResult.catch(() => {
                    setFallbackFullscreen(true);
                });
            }
            return;
        }

        if (activityCard) {
            const webkitRequest = activityCard.webkitRequestFullscreen || activityCard.webkitRequestFullScreen;
            if (webkitRequest) {
                webkitRequest.call(activityCard);
                return;
            }
        }

        setFallbackFullscreen(true);
    }

    function exitActivityFullscreen() {
        // Always try to exit both native and fallback fullscreen
        if (getFullscreenElement()) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
            if (exit) {
                const exitResult = exit.call(document);
                if (exitResult && exitResult.catch) {
                    exitResult.catch(() => {
                        // If native exit fails, still clear fallback
                        setFallbackFullscreen(false);
                    });
                } else {
                    // For browsers that don't return a promise
                    setTimeout(() => {
                        if (!getFullscreenElement()) {
                            setFallbackFullscreen(false);
                        }
                    }, 100);
                }
                return;
            }
        }
        // Always clear fallback state
        setFallbackFullscreen(false);
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
        updateAchievementLabels();
        updateStreakDisplay();
        loadActivity();
        updateUI();
    }

    function getNextSoundIndex() {
        if (LETTERS.length <= 1) {
            return 0;
        }

        let idx = Math.floor(Math.random() * LETTERS.length);
        if (typeof state.lastSoundIndex === "number") {
            let guard = 0;
            while (idx === state.lastSoundIndex && guard < 10) {
                idx = Math.floor(Math.random() * LETTERS.length);
                guard += 1;
            }
            if (idx === state.lastSoundIndex) {
                idx = (state.lastSoundIndex + 1) % LETTERS.length;
            }
        }
        return idx;
    }

    function getSoundChoices(targetLetter) {
        const pool = LETTERS
            .map((item) => item.letter)
            .filter((letter) => letter !== targetLetter);
        const wrongChoices = shuffleArray(pool).slice(0, 2);
        return shuffleArray([targetLetter, ...wrongChoices]);
    }

    // Sounds activity
    function renderSoundsActivity() {
        activityIcon.textContent = "🔤";
        activityTitle.textContent = t("activity.soundsTitle");

        showCharacterSpeech(t("sounds.prompt"));

        const targetIndex = getNextSoundIndex();
        state.lastSoundIndex = targetIndex;
        saveProgress();
        state.currentActivity = targetIndex;
        const target = LETTERS[targetIndex];
        const exampleText = getLetterExample(target);
        const exampleEmoji = getLetterEmoji(target);
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
                        <span class="letter-example">${exampleEmoji} ${exampleText}</span>
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
        let dragSource = null;
        let dragStartButton = null;
        let dragCandidate = null;
        let dragStartPoint = null;
        let hoverTarget = null;
        let suppressShapeClick = false;
        const dragThreshold = 8;

        shapeButtons.forEach(btn => {
            btn.addEventListener("click", (event) => {
                if (suppressShapeClick) {
                    suppressShapeClick = false;
                    event.preventDefault();
                    return;
                }
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

        function clearHoverStates() {
            updateHoverTarget(null);
            letterCard.classList.remove("hovered");
        }

        function resetDragLine() {
            dragLine.classList.remove("visible");
            dragLine.style.width = "0px";
        }

        function handleSoundMatch(targetButton) {
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
                    checkAchievements();

                    if (state.masteredSounds.length % 5 === 0) {
                        celebrate();
                    }

                    checkPhaseProgression();
                } else {
                    showToast(t("sounds.matchAgain", { letter: target.letter }), "success");
                }

                setTimeout(() => {
                    resetDragLine();
                    state.currentActivity = (targetIndex + 1) % LETTERS.length;
                    saveProgress();
                    renderSoundsActivity();
                }, 900);
            } else {
                targetButton.classList.add("wrong");
                showToast(t("sounds.tryAnotherFace"), "info");
                setTimeout(() => targetButton.classList.remove("wrong"), 350);
            }
        }

        letterCard.addEventListener("pointerdown", (event) => {
            if (locked) return;
            dragging = true;
            dragSource = "letter";
            letterCard.setPointerCapture(event.pointerId);
            letterCard.classList.add("dragging");
            dragLine.classList.add("visible");

            const start = getLetterCenter();
            const point = getStagePoint(event);
            setDragLine(start, point);
        });

        letterCard.addEventListener("pointermove", (event) => {
            if (!dragging || dragSource !== "letter") return;
            const start = getLetterCenter();
            const point = getStagePoint(event);
            setDragLine(start, point);

            const element = document.elementFromPoint(event.clientX, event.clientY);
            const targetButton = element ? element.closest(".shape-choice") : null;
            updateHoverTarget(targetButton);
        });

        letterCard.addEventListener("pointerup", (event) => {
            if (!dragging || dragSource !== "letter") return;
            dragging = false;
            dragSource = null;
            letterCard.releasePointerCapture(event.pointerId);
            letterCard.classList.remove("dragging");
            resetDragLine();

            const element = document.elementFromPoint(event.clientX, event.clientY);
            const targetButton = element ? element.closest(".shape-choice") : null;
            clearHoverStates();

            if (!targetButton) {
                showToast(t("sounds.dragToFace"), "info");
                return;
            }

            handleSoundMatch(targetButton);
        });

        letterCard.addEventListener("pointercancel", (event) => {
            if (!dragging || dragSource !== "letter") return;
            dragging = false;
            dragSource = null;
            letterCard.releasePointerCapture(event.pointerId);
            letterCard.classList.remove("dragging");
            resetDragLine();
            clearHoverStates();
        });

        shapeButtons.forEach((btn) => {
            btn.addEventListener("pointerdown", (event) => {
                if (locked) return;
                dragCandidate = { button: btn, pointerId: event.pointerId };
                dragStartPoint = { x: event.clientX, y: event.clientY };
                btn.setPointerCapture(event.pointerId);
            });

            btn.addEventListener("pointermove", (event) => {
                if (!dragCandidate || dragCandidate.button !== btn) return;
                const dx = event.clientX - dragStartPoint.x;
                const dy = event.clientY - dragStartPoint.y;
                if (!dragging && Math.hypot(dx, dy) > dragThreshold) {
                    dragging = true;
                    dragSource = "shape";
                    dragStartButton = btn;
                    dragLine.classList.add("visible");
                }

                if (!dragging || dragSource !== "shape") return;
                const start = getButtonCenter(dragStartButton);
                const point = getStagePoint(event);
                setDragLine(start, point);

                const element = document.elementFromPoint(event.clientX, event.clientY);
                const overLetter = element ? element.closest("#target-letter-card") : null;
                letterCard.classList.toggle("hovered", Boolean(overLetter));
            });

            btn.addEventListener("pointerup", (event) => {
                if (!dragCandidate || dragCandidate.button !== btn) return;
                const wasDragging = dragging && dragSource === "shape";
                dragging = false;
                dragSource = null;
                dragStartButton = null;
                btn.releasePointerCapture(event.pointerId);
                dragCandidate = null;
                dragStartPoint = null;

                if (!wasDragging) {
                    letterCard.classList.remove("hovered");
                    return;
                }

                suppressShapeClick = true;
                setTimeout(() => {
                    suppressShapeClick = false;
                }, 0);
                resetDragLine();

                const element = document.elementFromPoint(event.clientX, event.clientY);
                const overLetter = element ? element.closest("#target-letter-card") : null;
                letterCard.classList.remove("hovered");

                if (!overLetter) {
                    showToast(t("sounds.dragToLetter"), "info");
                    return;
                }

                handleSoundMatch(btn);
            });

            btn.addEventListener("pointercancel", (event) => {
                if (!dragCandidate || dragCandidate.button !== btn) return;
                dragging = false;
                dragSource = null;
                dragStartButton = null;
                btn.releasePointerCapture(event.pointerId);
                dragCandidate = null;
                dragStartPoint = null;
                resetDragLine();
                clearHoverStates();
            });
        });
    }

    // Words activity
    function renderWordsActivity() {
        activityIcon.textContent = "🔡";
        activityTitle.textContent = t("activity.wordsTitle");

        const shortWords = getShortWords();
        const word = shortWords[Math.floor(Math.random() * shortWords.length)];
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
                    checkAchievements();
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

        let isDragging = false;
        let dragStartPos = null;
        const DRAG_THRESHOLD = 5; // pixels to move before considering it a drag

        function placeLetterIntoSlot(slot) {
            if (!activeTile || slot.dataset.letter) return;
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

            tile.addEventListener("pointerdown", (event) => {
                if (tile.classList.contains("used")) return;
                dragStartPos = { x: event.clientX, y: event.clientY };
                isDragging = false; // Don't set to true until we've moved enough
                tile.setPointerCapture(event.pointerId);
            });

            tile.addEventListener("pointermove", (event) => {
                if (!dragStartPos) return;
                if (tile.classList.contains("used")) return;
                
                const dx = event.clientX - dragStartPos.x;
                const dy = event.clientY - dragStartPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (!isDragging && distance > DRAG_THRESHOLD) {
                    isDragging = true;
                    setActiveTile(tile);
                }
            });

            tile.addEventListener("pointerup", (event) => {
                if (!dragStartPos) return;
                
                if (isDragging) {
                    isDragging = false;
                    tile.releasePointerCapture(event.pointerId);
                    const element = document.elementFromPoint(event.clientX, event.clientY);
                    const slot = element ? element.closest(".drag-slot") : null;
                    if (slot) {
                        placeLetterIntoSlot(slot);
                    } else {
                        setActiveTile(null);
                    }
                }
                
                dragStartPos = null;
            });

            tile.addEventListener("pointercancel", (event) => {
                isDragging = false;
                dragStartPos = null;
                if (event.pointerId !== undefined) {
                    tile.releasePointerCapture(event.pointerId);
                }
                setActiveTile(null);
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
                    placeLetterIntoSlot(slot);
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

        activityArea.addEventListener("pointerup", (event) => {
            if (!isDragging) return;
            isDragging = false;
            const element = document.elementFromPoint(event.clientX, event.clientY);
            const slot = element ? element.closest(".drag-slot") : null;
            if (slot) {
                placeLetterIntoSlot(slot);
            }
        });
    }

    // Stories activity
    function renderStoriesActivity() {
        activityIcon.textContent = "📖";
        activityTitle.textContent = t("activity.storiesTitle");

        const stories = getStories();
        const storyIndex = state.currentActivity % stories.length;
        const story = stories[storyIndex];
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
                AudioSystem.speak(fullSentence, 0.8, 1.2);
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
                                checkAchievements();
                            }
                            state.activityStats.stories.correct += 1;
                            saveProgress();
                            showToast(t("stories.greatReading"), "success");
                            celebrate(1.5);
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

            let isDragging = false;
            let dragStartPos = null;
            const DRAG_THRESHOLD = 5; // pixels to move before considering it a drag

            function markStoryAttempt() {
                if (!storyAttempted) {
                    storyAttempted = true;
                    state.activityStats.stories.attempts += 1;
                    saveProgress();
                }
            }

            function placeLetterIntoSlot(slot) {
                if (!activeTile || slot.dataset.letter) return;
                markStoryAttempt();
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

                tile.addEventListener("pointerdown", (event) => {
                    if (tile.classList.contains("used")) return;
                    dragStartPos = { x: event.clientX, y: event.clientY };
                    isDragging = false; // Don't set to true until we've moved enough
                    tile.setPointerCapture(event.pointerId);
                });

                tile.addEventListener("pointermove", (event) => {
                    if (!dragStartPos) return;
                    if (tile.classList.contains("used")) return;
                    
                    const dx = event.clientX - dragStartPos.x;
                    const dy = event.clientY - dragStartPos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (!isDragging && distance > DRAG_THRESHOLD) {
                        isDragging = true;
                        setActiveTile(tile);
                    }
                });

                tile.addEventListener("pointerup", (event) => {
                    if (!dragStartPos) return;
                    
                    if (isDragging) {
                        isDragging = false;
                        tile.releasePointerCapture(event.pointerId);
                        const element = document.elementFromPoint(event.clientX, event.clientY);
                        const slot = element ? element.closest(".story-letter-slot") : null;
                        if (slot) {
                            placeLetterIntoSlot(slot);
                        } else {
                            setActiveTile(null);
                        }
                    }
                    
                    dragStartPos = null;
                });

                tile.addEventListener("pointercancel", (event) => {
                    isDragging = false;
                    dragStartPos = null;
                    if (event.pointerId !== undefined) {
                        tile.releasePointerCapture(event.pointerId);
                    }
                    setActiveTile(null);
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
                        placeLetterIntoSlot(slot);
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

            activityArea.addEventListener("pointerup", (event) => {
                if (!isDragging) return;
                isDragging = false;
                const element = document.elementFromPoint(event.clientX, event.clientY);
                const slot = element ? element.closest(".story-letter-slot") : null;
                if (slot) {
                    placeLetterIntoSlot(slot);
                }
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

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);

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
        checkStreak();
        applyTranslations();
        updateAchievementLabels();
        updateLanguageButtons();
        drawCharacter();
        loadActivity();

        // Welcome message with slight delay for better UX
        setTimeout(() => {
            showToast(t("toast.welcome"), "success");
        }, 500);
    }

    init();
});
