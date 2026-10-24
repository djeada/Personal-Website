/*
 * Helpers shared by the quiz app and the flashcard app: loading the
 * generated JSON, remembering progress in localStorage, keeping the setup
 * in the URL and typesetting maths on demand.
 */
(function() {
    "use strict";

    const MATHJAX_SRC = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-svg.js";
    let mathReady = null;

    async function fetchJson(url) {
        const response = await fetch(url, {
            cache: "no-cache"
        });
        if (!response.ok) {
            throw new Error(`${url}: HTTP ${response.status}`);
        }
        return response.json();
    }

    function shuffle(items) {
        const copy = items.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function store(namespace) {
        const prefix = `learning:${namespace}:`;
        return {
            get(key, fallback) {
                try {
                    const raw = window.localStorage.getItem(prefix + key);
                    return raw === null ? fallback : JSON.parse(raw);
                } catch (error) {
                    return fallback;
                }
            },
            set(key, value) {
                try {
                    window.localStorage.setItem(prefix + key, JSON.stringify(value));
                } catch (error) {
                    // Private windows and full quotas just lose progress.
                }
            }
        };
    }

    function readParams() {
        return new URLSearchParams(window.location.search);
    }

    function writeParams(values) {
        const params = new URLSearchParams();
        Object.entries(values).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") params.set(key, value);
        });
        const query = params.toString();
        const url = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
        window.history.replaceState(null, "", url);
    }

    function loadMath() {
        if (mathReady) return mathReady;
        mathReady = new Promise((resolve) => {
            window.MathJax = {
                tex: {
                    inlineMath: [
                        ["$", "$"],
                        ["\\(", "\\)"]
                    ],
                    displayMath: [
                        ["$$", "$$"],
                        ["\\[", "\\]"]
                    ],
                    processEscapes: true
                },
                options: {
                    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
                },
                startup: {
                    typeset: false,
                    ready() {
                        window.MathJax.startup.defaultReady();
                        resolve(window.MathJax);
                    }
                }
            };
            const script = document.createElement("script");
            script.src = MATHJAX_SRC;
            script.async = true;
            script.onerror = () => resolve(null);
            document.head.appendChild(script);
        });
        return mathReady;
    }

    async function typeset(elements) {
        const mathJax = await loadMath();
        if (!mathJax || !mathJax.typesetPromise) return;
        const targets = (Array.isArray(elements) ? elements : [elements]).filter(Boolean);
        if (mathJax.typesetClear) mathJax.typesetClear(targets);
        try {
            await mathJax.typesetPromise(targets);
        } catch (error) {
            console.warn("MathJax could not typeset", error);
        }
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function link(href, text) {
        const anchor = el("a", "", text);
        anchor.href = href;
        anchor.target = "_blank";
        anchor.rel = "noopener";
        return anchor;
    }

    window.Learning = {
        fetchJson,
        shuffle,
        store,
        readParams,
        writeParams,
        typeset,
        el,
        link
    };
})();