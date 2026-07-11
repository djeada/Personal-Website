(function () {
    "use strict";

    const STORAGE_KEY = "algorithms-course-progress-v1";
    const LAST_KEY = "algorithms-course-last-lesson-v1";

    function readCompleted() {
        try {
            const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return new Set(Array.isArray(value) ? value.map(Number).filter(Boolean) : []);
        } catch (_) {
            return new Set();
        }
    }

    function saveCompleted(completed) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed).sort((a, b) => a - b)));
        } catch (_) {
            // Progress is an enhancement; the course still works if storage is unavailable.
        }
    }

    function readLastLesson() {
        try {
            return Number(localStorage.getItem(LAST_KEY)) || 1;
        } catch (_) {
            return 1;
        }
    }

    function saveLastLesson(number) {
        try {
            localStorage.setItem(LAST_KEY, String(number));
        } catch (_) {
            // Ignore storage failures.
        }
    }

    const completed = readCompleted();
    const total = Number(document.querySelector("[data-lesson-total]")?.dataset.lessonTotal) ||
        document.querySelectorAll("[data-course-card]").length || 76;

    function paintProgress() {
        const count = completed.size;
        const percent = total ? Math.min(100, Math.round((count / total) * 100)) : 0;

        document.querySelectorAll("[data-course-completed-count]").forEach((node) => {
            node.textContent = String(count);
        });
        document.querySelectorAll("[data-course-progress-bar]").forEach((node) => {
            node.style.width = percent + "%";
            node.parentElement?.setAttribute("aria-label", `Course progress: ${count} of ${total} lessons complete`);
        });

        document.querySelectorAll("[data-course-card]").forEach((card) => {
            const number = Number(card.dataset.lessonNumber);
            const isComplete = completed.has(number);
            card.classList.toggle("is-complete", isComplete);
            const status = card.querySelector("[data-course-card-status]");
            if (status) status.textContent = isComplete ? "Completed" : "Not started";
        });

        document.querySelectorAll("[data-course-lesson]").forEach((item) => {
            item.classList.toggle("is-complete", completed.has(Number(item.dataset.courseLesson)));
        });

        const completeButton = document.querySelector("[data-course-complete]");
        if (completeButton) {
            const number = Number(completeButton.dataset.courseComplete);
            const isComplete = completed.has(number);
            completeButton.classList.toggle("is-complete", isComplete);
            completeButton.setAttribute("aria-pressed", String(isComplete));
            const label = completeButton.querySelector("[data-complete-label]");
            if (label) label.textContent = isComplete ? "Lesson completed" : "Mark lesson complete";
        }
    }

    function initializeOverview() {
        const cards = Array.from(document.querySelectorAll("[data-course-card]"));
        if (!cards.length) return;

        const continueLink = document.querySelector("[data-course-continue]");
        const requestedLesson = readLastLesson();
        const continueCard = cards.find((card) => Number(card.dataset.lessonNumber) === requestedLesson) ||
            cards.find((card) => !completed.has(Number(card.dataset.lessonNumber))) || cards[0];
        const continueTarget = continueCard?.querySelector(".course-card-main")?.getAttribute("href");
        if (continueLink && continueTarget) {
            continueLink.setAttribute("href", continueTarget);
            continueLink.firstChild.textContent = requestedLesson > 1 ? `Continue lesson ${continueCard.dataset.lessonNumber} ` : "Start lesson 1 ";
        }

        let activeTopic = "all";
        const search = document.getElementById("course-search");
        const count = document.querySelector("[data-course-result-count]");
        const empty = document.querySelector("[data-course-empty]");

        function filterCards() {
            const query = (search?.value || "").trim().toLowerCase();
            let visible = 0;
            cards.forEach((card) => {
                const matchesTopic = activeTopic === "all" || card.dataset.topic === activeTopic;
                const matchesSearch = !query || (card.dataset.title || "").includes(query);
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
    }

    function initializeLesson() {
        const body = document.body;
        if (body.dataset.coursePage !== "lesson") return;
        const number = Number(body.dataset.lessonNumber);
        if (!number) return;
        saveLastLesson(number);

        const completeButton = document.querySelector("[data-course-complete]");
        completeButton?.addEventListener("click", () => {
            if (completed.has(number)) completed.delete(number);
            else {
                completed.add(number);
                if (number < total) saveLastLesson(number + 1);
            }
            saveCompleted(completed);
            paintProgress();
        });
    }

    initializeOverview();
    initializeLesson();
    paintProgress();
}());
