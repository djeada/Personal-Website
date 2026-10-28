(function() {
    "use strict";

    const MATHJAX_SRC = "https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-svg.js";

    const PRISM_BASE = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0";
    let mathReady = null;
    let prismReady = null;

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
                    processEscapes: true,


                    macros: {
                        frac: ["\\dfrac{#1}{#2}", 2]
                    }
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

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function loadPrism() {
        if (prismReady) return prismReady;
        window.Prism = window.Prism || {};
        window.Prism.manual = true;
        prismReady = loadScript(`${PRISM_BASE}/components/prism-core.min.js`)
            .then(() => loadScript(`${PRISM_BASE}/plugins/autoloader/prism-autoloader.min.js`))
            .then(() => {
                window.Prism.plugins.autoloader.languages_path = `${PRISM_BASE}/components/`;
                return window.Prism;
            })
            .catch(() => null);
        return prismReady;
    }


    async function highlight(elements) {
        const targets = (Array.isArray(elements) ? elements : [elements]).filter(Boolean);


        const codes = targets
            .flatMap((node) => Array.from(node.querySelectorAll('code[class*="language-"]')))
            .filter((code) => code.closest("pre") || code.textContent.trim().split(/\s+/).length < 6);
        if (!codes.length) return;
        const prism = await loadPrism();
        if (!prism) return;
        codes.forEach((code) => {
            if (code.dataset.highlighted === "true") return;
            code.dataset.highlighted = "true";
            prism.highlightElement(code);
        });
    }


    function enhance(elements, math) {
        highlight(elements);
        if (math) typeset(elements);
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



    function scrollIntoFocus(node, smooth) {
        window.requestAnimationFrame(() => {
            const nav = document.querySelector('nav');
            const offset = (nav ? nav.getBoundingClientRect().height : 0) + 24;
            const top = node.getBoundingClientRect().top + window.scrollY - offset;
            const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (Math.abs(window.scrollY - top) > 4) {
                window.scrollTo({
                    top: Math.max(top, 0),
                    behavior: smooth && !calm ? 'smooth' : 'instant'
                });
            }
        });
    }





    function startDock(screen) {
        const dock = screen.querySelector(".la-dock");
        const panel = screen.querySelector(".la-start");
        if (!dock || !panel || !("IntersectionObserver" in window)) return;
        const summary = panel.querySelector(".la-start-summary");
        const start = panel.querySelector("button.primary");
        const copy = dock.querySelector(".la-dock-summary");
        const go = dock.querySelector('[data-dock="start"]');
        const settings = dock.querySelector('[data-dock="settings"]');
        let ready = false;

        const sync = () => {
            copy.innerHTML = summary.innerHTML;
            go.textContent = start.textContent;
            go.disabled = start.disabled;
            if (ready) {
                dock.classList.remove("is-updated");
                void dock.offsetWidth;
                dock.classList.add("is-updated");
            }
        };
        const watch = {
            childList: true,
            subtree: true,
            characterData: true
        };
        new MutationObserver(sync).observe(summary, watch);
        new MutationObserver(sync).observe(start, {
            ...watch,
            attributes: true,
            attributeFilter: ["disabled"]
        });
        sync();

        window.setTimeout(() => {
            ready = true;
        }, 800);

        go.addEventListener("click", () => start.click());
        if (settings) {
            settings.addEventListener("click", () => {
                const target = screen.querySelector(settings.dataset.target) || panel;
                scrollIntoFocus(target, true);
            });
        }


        new IntersectionObserver(([entry]) => {
            dock.hidden = entry.isIntersecting || entry.boundingClientRect.top < 0;
        }, {
            rootMargin: "0px 0px 96px 0px"
        }).observe(panel);
    }



    function topicPicker(container, topics, selected, countOf, onChange) {
        container.innerHTML = "";
        const groups = new Map();
        topics.forEach((topic) => {
            const key = topic.group || "";
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(topic);
        });
        const boxes = [];
        groups.forEach((members, group) => {
            if (groups.size > 1 && group) container.appendChild(el("p", "la-topic-group", group));
            const list = el("div", "la-topic-list");
            members.forEach((topic) => {
                const row = el("label", "la-topic");
                const input = document.createElement("input");
                input.type = "checkbox";
                input.value = topic.slug;
                input.checked = !selected.size || selected.has(topic.slug);
                input.addEventListener("change", emit);
                boxes.push(input);
                row.appendChild(input);
                row.appendChild(el("span", "la-topic-name", topic.name));
                row.appendChild(el("span", "la-topic-count", String(countOf(topic))));
                list.appendChild(row);
            });
            container.appendChild(list);
        });

        function emit() {
            const checked = boxes.filter((box) => box.checked).map((box) => box.value);
            onChange(checked.length === boxes.length ? [] : checked.length ? checked : ["__none__"]);
        }

        return {
            setAll(on) {
                boxes.forEach((box) => {
                    box.checked = on;
                });
                emit();
            }
        };
    }

    function topicSummary(topics, selected) {
        if (!selected.size) return `All ${topics.length} topics`;
        const chosen = topics.filter((topic) => selected.has(topic.slug));
        if (!chosen.length) return "No topics selected";
        const names = chosen.map((topic) => topic.name);
        const shown = names.slice(0, 2).join(", ") + (names.length > 2 ? ` and ${names.length - 2} more` : "");
        return `${chosen.length} of ${topics.length}: ${shown}`;
    }


    function segmented(container, name, options, current, onChange) {
        container.innerHTML = "";
        options.forEach((option) => {
            const label = el("label");
            const input = document.createElement("input");
            input.type = "radio";
            input.name = name;
            input.value = String(option.value);
            input.checked = option.value === current;
            input.addEventListener("change", () => onChange(option.value));
            label.appendChild(input);
            label.appendChild(el("span", "", option.label));
            container.appendChild(label);
        });
    }



    function glyph(text) {
        const mark = el("span", "la-tile-glyph", text);
        mark.setAttribute("aria-hidden", "true");
        return mark;
    }

    function balanceTiles(container, count) {
        const cols = count === 4 ? 2 : Math.max(1, Math.min(count, 3));
        container.style.setProperty("--la-cols", cols);

        if (cols === 3 && count % 3) container.dataset.rest = String(count % 3);
        else delete container.dataset.rest;
    }

    window.Learning = {
        highlight,
        enhance,
        balanceTiles,
        startDock,
        glyph,
        topicPicker,
        topicSummary,
        segmented,
        scrollIntoFocus,
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