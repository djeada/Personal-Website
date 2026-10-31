(function(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.DDDSrs = api;
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";


    const INTERVALS = [0, 1, 3, 7, 14, 30, 60, 120];
    const KNOWN_STEP = 4;
    const RETRY_GAP = 3;
    const DAY_MS = 86400000;

    function today(now = Date.now()) {
        const date = new Date(now);
        return Math.floor((now - date.getTimezoneOffset() * 60000) / DAY_MS);
    }

    function blank() {
        return {
            v: 1,
            words: {},
            days: {},
            best: {}
        };
    }

    function card(progress, id) {
        const raw = progress.words[id];
        if (!raw) return null;
        return {
            step: raw[0],
            due: raw[1],
            seen: raw[2],
            right: raw[3],
            wrong: raw[4],
            last: raw[5],
            lastWrong: raw[6] || 0
        };
    }

    function status(progress, id, day) {
        const state = card(progress, id);
        if (!state) return "new";
        if (state.step >= KNOWN_STEP) return "known";
        if (state.lastWrong && state.lastWrong >= state.last - 1 && state.step <= 1) return "difficult";
        return state.due <= day ? "due" : "learning";
    }

    function record(progress, id, correct, day) {
        const state = card(progress, id) || {
            step: 0,
            due: day,
            seen: 0,
            right: 0,
            wrong: 0,
            last: day,
            lastWrong: 0
        };
        state.seen += 1;
        if (correct) {
            state.right += 1;
            state.step = Math.min(state.step + 1, INTERVALS.length - 1);
            state.due = day + INTERVALS[state.step];
        } else {
            state.wrong += 1;
            state.step = 0;
            state.due = day;
            state.lastWrong = day;
        }
        state.last = day;
        progress.words[id] = [state.step, state.due, state.seen, state.right, state.wrong, state.last, state.lastWrong];
        const log = progress.days[day] || [0, 0];
        log[0] += 1;
        log[1] += correct ? 1 : 0;
        progress.days[day] = log;
        return state;
    }

    function streak(progress, day) {
        let count = 0;
        let cursor = progress.days[day] ? day : day - 1;
        while (progress.days[cursor]) {
            count += 1;
            cursor -= 1;
        }
        return count;
    }

    function interleave(reviews, fresh) {
        if (!fresh.length) return reviews;
        if (!reviews.length) return fresh;
        const out = [];
        const gap = Math.max(1, Math.floor(reviews.length / fresh.length));
        let r = 0;
        fresh.forEach((item) => {
            for (let k = 0; k < gap && r < reviews.length; k++) out.push(reviews[r++]);
            out.push(item);
        });
        while (r < reviews.length) out.push(reviews[r++]);
        return out;
    }

    function plan(entries, progress, day, options) {
        const size = options.size;
        const due = [];
        const fresh = [];
        entries.forEach((entry) => {
            const state = card(progress, entry.id);
            if (!state) fresh.push(entry);
            else if (state.due <= day) due.push([entry, state]);
        });
        due.sort((a, b) => a[1].due - b[1].due || b[1].wrong - a[1].wrong);
        const reviews = due.slice(0, size).map(([entry]) => entry);
        const newCount = Math.max(0, Math.min(options.newWords, size - reviews.length, fresh.length));
        return {
            items: interleave(reviews, fresh.slice(0, newCount)),
            dueTotal: due.length,
            newTotal: fresh.length,
            reviews: reviews.length,
            fresh: newCount
        };
    }

    function shuffle(items, random = Math.random) {
        const copy = items.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function weakest(entries, progress, size) {
        return entries
            .map((entry) => [entry, card(progress, entry.id)])
            .filter(([, state]) => state && state.wrong > 0)
            .sort((a, b) => b[1].lastWrong - a[1].lastWrong || (b[1].wrong / b[1].seen) - (a[1].wrong / a[1].seen))
            .slice(0, size)
            .map(([entry]) => entry);
    }

    function Session(items) {
        this.queue = items.slice();
        this.total = items.length;
        this.done = 0;
        this.answered = new Map();
        this.history = [];
    }

    Session.prototype.current = function() {
        return this.queue[0] || null;
    };

    Session.prototype.isRetry = function() {
        const item = this.current();
        return Boolean(item && this.answered.has(item.id));
    };


    Session.prototype.answer = function(correct) {
        const item = this.queue.shift();
        const first = !this.answered.has(item.id);
        if (first) {
            this.answered.set(item.id, correct);
            this.history.push({
                entry: item,
                correct
            });
        }
        if (correct) {
            this.done += 1;
        } else {
            this.queue.splice(Math.min(RETRY_GAP, this.queue.length), 0, item);
        }
        return first;
    };

    Session.prototype.finished = function() {
        return this.queue.length === 0;
    };

    return {
        INTERVALS,
        KNOWN_STEP,
        Session,
        blank,
        card,
        plan,
        record,
        shuffle,
        status,
        streak,
        today,
        weakest
    };
});