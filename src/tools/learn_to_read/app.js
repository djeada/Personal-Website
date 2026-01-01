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

    // Stats elements
    const starsCount = document.getElementById("stars-count");
    const soundsLearned = document.getElementById("sounds-learned");
    const wordsLearned = document.getElementById("words-learned");
    const storiesRead = document.getElementById("stories-read");
    const parentPhase = document.getElementById("parent-phase");
    const parentProgress = document.getElementById("parent-progress");

    // Character canvas context
    const ctx = characterCanvas.getContext("2d");

    // Learning phases
    const PHASES = {
        SOUNDS: "sounds",
        BLENDS: "blends",
        WORDS: "words",
        SENTENCES: "sentences"
    };

    // Letter data with phonics sounds
    const LETTERS = [
        { letter: "A", sound: "ah", example: "apple" },
        { letter: "B", sound: "buh", example: "ball" },
        { letter: "C", sound: "kuh", example: "cat" },
        { letter: "D", sound: "duh", example: "dog" },
        { letter: "E", sound: "eh", example: "egg" },
        { letter: "F", sound: "fuh", example: "fish" },
        { letter: "G", sound: "guh", example: "goat" },
        { letter: "H", sound: "huh", example: "hat" },
        { letter: "I", sound: "ih", example: "igloo" },
        { letter: "J", sound: "juh", example: "jam" },
        { letter: "K", sound: "kuh", example: "kite" },
        { letter: "L", sound: "luh", example: "lion" },
        { letter: "M", sound: "muh", example: "mouse" },
        { letter: "N", sound: "nuh", example: "nest" },
        { letter: "O", sound: "oh", example: "octopus" },
        { letter: "P", sound: "puh", example: "pig" },
        { letter: "Q", sound: "kwuh", example: "queen" },
        { letter: "R", sound: "ruh", example: "rabbit" },
        { letter: "S", sound: "sss", example: "sun" },
        { letter: "T", sound: "tuh", example: "turtle" },
        { letter: "U", sound: "uh", example: "umbrella" },
        { letter: "V", sound: "vuh", example: "van" },
        { letter: "W", sound: "wuh", example: "whale" },
        { letter: "X", sound: "ks", example: "box" },
        { letter: "Y", sound: "yuh", example: "yellow" },
        { letter: "Z", sound: "zzz", example: "zebra" }
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
        phaseProgress: {
            sounds: 0,
            blends: 0,
            words: 0,
            sentences: 0
        }
    };

    // Audio system using Web Speech API
    const AudioSystem = {
        synth: window.speechSynthesis,
        speaking: false,

        speak(text, rate = 0.8, pitch = 1.2) {
            if (this.synth.speaking) {
                this.synth.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate;
            utterance.pitch = pitch;
            utterance.volume = 1;

            // Try to use a child-friendly voice
            const voices = this.synth.getVoices();
            const preferredVoice = voices.find(v =>
                v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Samantha"))
            ) || voices.find(v => v.lang.startsWith("en"));

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
            const phrases = [
                "Great job!",
                "You did it!",
                "Wonderful!",
                "Amazing!",
                "Keep going!",
                "You're a star!"
            ];
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

    // Start blinking animation
    setInterval(blinkEyes, 3000 + Math.random() * 2000);

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
        const saved = localStorage.getItem("learnToReadProgress");
        if (saved) {
            try {
                state = JSON.parse(saved);
            } catch (e) {
                console.error("Error loading progress:", e);
            }
        }
        updateUI();
    }

    function saveProgress() {
        localStorage.setItem("learnToReadProgress", JSON.stringify(state));
        updateUI();
    }

    function resetProgress() {
        if (confirm("Are you sure you want to reset all progress?")) {
            localStorage.removeItem("learnToReadProgress");
            state = {
                currentPhase: PHASES.SOUNDS,
                currentActivity: 0,
                stars: 0,
                masteredSounds: [],
                masteredWords: [],
                completedStories: [],
                phaseProgress: {
                    sounds: 0,
                    blends: 0,
                    words: 0,
                    sentences: 0
                }
            };
            saveProgress();
            loadActivity();
            showToast("Progress reset!", "info");
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
            } else {
                item.classList.add("locked");
            }
        });

        document.querySelectorAll(".phase-connector").forEach((connector, index) => {
            connector.classList.toggle("completed", index < currentIndex);
        });

        // Update parent info
        const phaseNames = {
            sounds: "Letter Sounds",
            blends: "Sound Blending",
            words: "Word Building",
            sentences: "Stories"
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
        switch (phase) {
            case PHASES.SOUNDS:
                return true;
            case PHASES.BLENDS:
                return state.masteredSounds.length >= 10;
            case PHASES.WORDS:
                return state.masteredSounds.length >= 20;
            case PHASES.SENTENCES:
                return state.masteredWords.length >= 5;
            default:
                return false;
        }
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
                showToast("New phase unlocked!", "success");
                celebrate();
                AudioSystem.speak("Great job! You unlocked a new level!");
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

    // Sounds activity
    function renderSoundsActivity() {
        activityIcon.textContent = "🔤";
        activityTitle.textContent = "Letter Sounds";

        showCharacterSpeech("Tap a letter to hear its sound!");
        AudioSystem.speak("Tap a letter to hear its sound!");

        let html = '<div class="letter-grid">';

        LETTERS.forEach(({ letter, sound }) => {
            const isMastered = state.masteredSounds.includes(letter);
            html += `
                <button class="letter-btn ${isMastered ? "mastered" : ""}" data-letter="${letter}">
                    ${letter}
                    <span class="sound-hint">${sound}</span>
                </button>
            `;
        });

        html += "</div>";
        activityArea.innerHTML = html;

        // Add click handlers
        activityArea.querySelectorAll(".letter-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const letter = btn.dataset.letter;
                AudioSystem.speakLetter(letter);

                // Mark as practiced
                if (!state.masteredSounds.includes(letter)) {
                    state.masteredSounds.push(letter);
                    state.stars += 1;
                    btn.classList.add("mastered");
                    saveProgress();
                    showToast(`You learned the "${letter}" sound!`, "success");

                    if (state.masteredSounds.length % 5 === 0) {
                        celebrate();
                    }

                    checkPhaseProgression();
                }
            });
        });
    }

    // Blends activity
    function renderBlendsActivity() {
        activityIcon.textContent = "🔗";
        activityTitle.textContent = "Sound Blending";

        const wordIndex = state.currentActivity % CVC_WORDS.length;
        const wordData = CVC_WORDS[wordIndex];

        showCharacterSpeech(`Let's blend sounds to make: ${wordData.word}`);
        AudioSystem.speak(`Let's blend the sounds together!`);

        let html = `
            <div class="word-builder">
                <div class="target-word">
                    <button class="sound-btn" id="play-word-btn">🔊</button>
                    Listen and blend!
                </div>
                <div class="word-slots" id="word-slots">
                    ${wordData.sounds.map((s, i) => `
                        <div class="word-slot" data-index="${i}" data-sound="${s}">
                            <button class="sound-btn" style="font-size: 1.2rem; width: 40px; height: 40px;">🔊</button>
                        </div>
                    `).join("")}
                </div>
                <p style="font-size: 1.2rem; color: var(--text-secondary); margin-top: 20px;">
                    Tap each sound, then tap 🔊 to hear the whole word!
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
        activityTitle.textContent = "Word Building";

        const wordIndex = state.currentActivity % CVC_WORDS.length;
        const wordData = CVC_WORDS[wordIndex];

        showCharacterSpeech(`Build the word: ${wordData.word}`);
        AudioSystem.speak(`Can you build the word ${wordData.word}?`);

        // Shuffle letters for choices
        const extraLetters = ["x", "z", "q", "k"];
        const choices = [...wordData.sounds];
        while (choices.length < 6) {
            const extra = extraLetters[Math.floor(Math.random() * extraLetters.length)];
            if (!choices.includes(extra)) {
                choices.push(extra);
            }
        }
        choices.sort(() => Math.random() - 0.5);

        let html = `
            <div class="word-builder">
                <div class="target-word">
                    <button class="sound-btn" id="play-target-btn">🔊</button>
                    Build: <strong>${wordData.word.toUpperCase()}</strong>
                </div>
                <div class="word-slots" id="word-slots">
                    ${wordData.sounds.map((_, i) => `
                        <div class="word-slot" data-index="${i}"></div>
                    `).join("")}
                </div>
                <div class="letter-choices" id="letter-choices">
                    ${choices.map(letter => `
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
                            showToast(`You built "${wordData.word}"!`, "success");
                            celebrate();
                            AudioSystem.speakEncouragement();
                            checkPhaseProgression();
                        }, 500);
                    }
                } else {
                    btn.style.animation = "shake 0.3s ease";
                    setTimeout(() => btn.style.animation = "", 300);
                    showToast("Try another letter!", "info");
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
        activityTitle.textContent = "Story Time";

        const storyIndex = state.currentActivity % STORIES.length;
        const story = STORIES[storyIndex];

        showCharacterSpeech("Let's read a story together!");
        AudioSystem.speak("Let's read a story together!");

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
                        <span class="btn-text">Read Story</span>
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
                    showToast("Great reading!", "success");
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
                showToast("Complete more activities to unlock!", "info");
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
        drawCharacter();
        loadActivity();

        showToast("Welcome to Phonics Adventure!", "success");
    }

    init();
});
