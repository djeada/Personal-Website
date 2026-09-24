(function() {
    "use strict";

    const STORAGE_KEY = "algorithms-course-progress-v1";
    const LAST_KEY = "algorithms-course-last-lesson-v1";

    const storage = (function() {
        try {
            const probe = "__algorithms-course__";
            window.localStorage.setItem(probe, probe);
            window.localStorage.removeItem(probe);
            return window.localStorage;
        } catch (_) {
            return null;
        }
    }());

    function read(key) {
        try {
            return storage ? storage.getItem(key) : null;
        } catch (_) {
            return null;
        }
    }

    function write(key, value) {
        try {
            if (storage) storage.setItem(key, value);
        } catch (_) {
            return;
        }
    }

    function readCompleted() {
        try {
            const value = JSON.parse(read(STORAGE_KEY) || "[]");
            return new Set(Array.isArray(value) ? value.map(Number).filter(Boolean) : []);
        } catch (_) {
            return new Set();
        }
    }

    const completed = readCompleted();
    const total = Number(document.querySelector("[data-lesson-total]")?.dataset.lessonTotal) ||
        document.querySelectorAll("[data-course-card]").length || 1;

    function saveCompleted() {
        write(STORAGE_KEY, JSON.stringify(Array.from(completed).sort((a, b) => a - b)));
    }

    function readLastLesson() {
        return Number(read(LAST_KEY)) || 0;
    }

    function saveLastLesson(number) {
        write(LAST_KEY, String(number));
    }

    function paintProgress() {
        const count = Array.from(completed).filter((number) => number >= 1 && number <= total).length;
        const percent = Math.min(100, Math.round((count / total) * 100));

        document.querySelectorAll("[data-course-completed-count]").forEach((node) => {
            node.textContent = String(count);
        });
        document.querySelectorAll("[data-course-progress-bar]").forEach((node) => {
            node.style.width = percent + "%";
            node.parentElement?.setAttribute("aria-label", `Course progress: ${count} of ${total} lessons complete`);
        });

        const lastLesson = readLastLesson();
        document.querySelectorAll("[data-course-card]").forEach((card) => {
            const number = Number(card.dataset.lessonNumber);
            const isComplete = completed.has(number);
            const isCurrent = !isComplete && number === lastLesson;
            card.classList.toggle("is-complete", isComplete);
            card.classList.toggle("is-current", isCurrent);
            const status = card.querySelector("[data-course-card-status]");
            if (status) status.textContent = isComplete ? "Completed" : (isCurrent ? "Up next" : "Not started");
        });

        document.querySelectorAll("[data-course-lesson]").forEach((item) => {
            const isComplete = completed.has(Number(item.dataset.courseLesson));
            item.classList.toggle("is-complete", isComplete);
            const link = item.querySelector("a");
            if (link) link.title = isComplete ? "Completed" : "";
        });

        const completeButton = document.querySelector("[data-course-complete]");
        if (completeButton) {
            const isComplete = completed.has(Number(completeButton.dataset.courseComplete));
            completeButton.classList.toggle("is-complete", isComplete);
            completeButton.setAttribute("aria-pressed", String(isComplete));
            const label = completeButton.querySelector("[data-complete-label]");
            if (label) label.textContent = isComplete ? "Completed ✓" : "Mark lesson complete";
            document.querySelector("[data-course-next]")?.classList.toggle("is-ready", isComplete);
        }

        document.querySelectorAll("[data-course-reset]").forEach((button) => {
            button.hidden = !storage || count === 0;
        });
    }

    function showStorageNote() {
        if (storage) return;
        document.querySelectorAll("[data-course-storage-note]").forEach((note) => {
            note.hidden = false;
        });
    }

    function initializeOverview() {
        const cards = Array.from(document.querySelectorAll("[data-course-card]"));
        if (!cards.length) return;

        const continueLink = document.querySelector("[data-course-continue]");
        const lastLesson = readLastLesson();
        const hasProgress = lastLesson > 0 || completed.size > 0;
        const continueCard = cards.find((card) => Number(card.dataset.lessonNumber) === lastLesson && !completed.has(lastLesson)) ||
            cards.find((card) => !completed.has(Number(card.dataset.lessonNumber))) || cards[0];
        const continueTarget = continueCard?.querySelector(".course-card-main")?.getAttribute("href");
        if (continueLink && continueTarget && hasProgress) {
            continueLink.setAttribute("href", continueTarget);
            continueLink.firstChild.textContent = `Continue with lesson ${continueCard.dataset.lessonNumber} `;
        }

        let activeTopic = "all";
        const search = document.getElementById("course-search");
        const count = document.querySelector("[data-course-result-count]");
        const empty = document.querySelector("[data-course-empty]");

        function filterCards() {
            const terms = (search?.value || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
            let visible = 0;
            cards.forEach((card) => {
                const haystack = card.dataset.search || card.dataset.title || "";
                const matchesTopic = activeTopic === "all" || card.dataset.topic === activeTopic;
                const matchesSearch = terms.every((term) => haystack.includes(term));
                const show = matchesTopic && matchesSearch;
                card.hidden = !show;
                if (show) visible += 1;
            });
            if (count) count.textContent = String(visible);
            if (empty) empty.hidden = visible !== 0;
        }

        document.querySelectorAll("[data-course-filter]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.classList.contains("is-active")));
            button.addEventListener("click", () => {
                activeTopic = button.dataset.courseFilter || "all";
                document.querySelectorAll("[data-course-filter]").forEach((item) => {
                    const active = item === button;
                    item.classList.toggle("is-active", active);
                    item.setAttribute("aria-pressed", String(active));
                });
                filterCards();
            });
        });
        search?.addEventListener("input", filterCards);
        filterCards();

        document.querySelectorAll("[data-course-reset]").forEach((button) => {
            button.addEventListener("click", () => {
                if (!window.confirm("Reset your progress for all lessons?")) return;
                completed.clear();
                saveCompleted();
                write(LAST_KEY, "");
                paintProgress();
                if (continueLink && cards[0]) {
                    continueLink.setAttribute("href", cards[0].querySelector(".course-card-main").getAttribute("href"));
                    continueLink.firstChild.textContent = "Start lesson 1 ";
                }
            });
        });
    }

    function initializeLesson() {
        if (document.body.dataset.coursePage !== "lesson") return;
        const number = Number(document.body.dataset.lessonNumber);
        if (!number) return;
        saveLastLesson(number);

        const outline = document.querySelector("[data-course-outline]");
        const current = outline?.querySelector('[aria-current="page"]');
        if (outline && current && outline.scrollHeight > outline.clientHeight) {
            outline.scrollTop = Math.max(0, current.offsetTop - outline.offsetTop - outline.clientHeight / 3);
        }

        document.querySelector("[data-course-complete]")?.addEventListener("click", () => {
            if (completed.has(number)) {
                completed.delete(number);
                saveLastLesson(number);
            } else {
                completed.add(number);
                if (number < total) saveLastLesson(number + 1);
            }
            saveCompleted();
            paintProgress();
        });
    }

    function initializeVideoFallback() {
        if (typeof window.initVideoFacades === "function") return;
        document.querySelectorAll(".course-lesson-video .video-facade").forEach((button) => {
            button.addEventListener("click", () => {
                const iframe = document.createElement("iframe");
                iframe.src = `https://www.youtube-nocookie.com/embed/${button.dataset.videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
                iframe.title = button.dataset.videoTitle || "YouTube video";
                iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share";
                iframe.allowFullscreen = true;
                iframe.referrerPolicy = "strict-origin-when-cross-origin";
                button.replaceWith(iframe);
            }, {
                once: true
            });
        });
    }

    initializeOverview();
    initializeLesson();
    showStorageNote();
    paintProgress();
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeVideoFallback);
    } else {
        initializeVideoFallback();
    }
}());