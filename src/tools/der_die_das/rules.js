(function(root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    else root.DDDRules = api;
})(typeof self !== "undefined" ? self : this, function() {
    "use strict";

    const ARTICLE = {
        m: "der",
        f: "die",
        n: "das"
    };
    const GENDER = {
        m: "masculine",
        f: "feminine",
        n: "neuter"
    };
    const STRONG = 0.9;
    const USUAL = 0.75;
    const MIN_WORDS = 8;

    const SUFFIXES = [
        ["ung", "f"],
        ["heit", "f"],
        ["keit", "f"],
        ["schaft", "f"],
        ["ion", "f"],
        ["tät", "f"],
        ["ik", "f"],
        ["ur", "f"],
        ["ei", "f"],
        ["ie", "f"],
        ["enz", "f"],
        ["anz", "f"],
        ["erin", "f"],
        ["in", "f"],
        ["ade", "f"],
        ["age", "f"],
        ["ette", "f"],
        ["itis", "f"],
        ["ose", "f"],
        ["e", "f"],
        ["ee", "m"],
        ["chen", "n", /[^aeiouäöü]chen$/],
        ["lein", "n"],
        ["ment", "n"],
        ["um", "n"],
        ["ma", "n"],
        ["nis", "n"],
        ["tum", "n"],
        ["o", "n"],
        ["ett", "n"],
        ["ing", "n"],
        ["il", "n"],
        ["al", "n"],
        ["ling", "m"],
        ["ismus", "m"],
        ["or", "m"],
        ["ant", "m"],
        ["ent", "m"],
        ["ist", "m"],
        ["ig", "m"],
        ["ich", "m"],
        ["eur", "m"],
        ["us", "m"],
        ["ast", "m"],
        ["er", "m"],
        ["en", "m"]
    ];

    const FIRST_PARTS = /^(?:ein|aus|vor|nach|unter|über|mit|auf|ab|bei|durch|gegen|hinter|neben|zwischen|haupt|groß|klein|ober|hoch|tief|lang|kurz|alt|neu|frei|selbst|fern|voll|halb|rück|wieder|miss|lieblings|schlaf|wohn|bade|spiel|fahr|wasch|kühl|schreib|lese|koch|ess|trink|sing|lauf|warte|park|sprech|lehr|hör|denk|merk|kauf|bau|leb|arbeits|staats|welt|stadt|land|haus|zimmer)$/i;
    
    const NOT_COMPOUNDS = new Set(["Kontrolle", "Katastrophe", "Programm", "Fotograf", "Kontakt", "Uniform",
        "Terrasse", "Strecke", "Protest", "Klamotte", "Schriftsteller", "Fernseher", "Diplomat", "Kandidat",
        "Telegramm", "Paragraf", "Biograf", "Kilogramm", "Melodie", "Komödie", "Tragödie"
    ]);

    const GROUPS = [{
        id: "days",
        gender: "m",
        title: "Days, months and seasons",
        words: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonnabend", "Sonntag",
            "Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober",
            "November", "Dezember", "Frühling", "Sommer", "Herbst", "Winter", "Wochentag"
        ]
    }, {
        id: "compass",
        gender: "m",
        title: "Points of the compass",
        words: ["Norden", "Süden", "Osten", "Westen", "Nordosten", "Nordwesten", "Südosten", "Südwesten"]
    }, {
        id: "weather",
        gender: "m",
        title: "Weather",
        words: ["Regen", "Schnee", "Wind", "Sturm", "Nebel", "Hagel", "Donner", "Blitz", "Frost", "Orkan",
            "Tornado", "Hurrikan", "Taifun", "Föhn", "Nieselregen", "Schauer"
        ]
    }, {
        id: "colours",
        gender: "n",
        title: "Colours used as nouns",
        words: ["Blau", "Rot", "Grün", "Gelb", "Weiß", "Schwarz", "Braun", "Grau", "Rosa", "Lila", "Orange",
            "Violett", "Türkis", "Beige"
        ]
    }, {
        id: "metals",
        gender: "n",
        title: "Metals and chemical elements",
        words: ["Gold", "Silber", "Eisen", "Kupfer", "Blei", "Zinn", "Zink", "Aluminium", "Uran", "Platin",
            "Messing", "Metall", "Nickel", "Chrom", "Titan", "Quecksilber", "Plutonium", "Helium", "Radium"
        ]
    }, {
        id: "young",
        gender: "n",
        title: "Young animals",
        words: ["Kalb", "Lamm", "Fohlen", "Ferkel", "Küken", "Kitz", "Kätzchen", "Welpe"]
    }];

    function matchSuffix(word) {
        const lower = word.toLowerCase();
        let best = null;
        for (const [suffix, gender, pattern] of SUFFIXES) {
            if (pattern && !pattern.test(lower)) continue;
            if (lower.length > suffix.length + 1 && lower.endsWith(suffix) && (!best || suffix.length > best.suffix.length)) {
                best = {
                    suffix,
                    gender
                };
            }
        }
        return best;
    }

    function primaryGender(entry) {
        return entry.articles.length === 1 ? entry.articles : null;
    }

    function create(entries) {
        const byWord = new Map();
        entries.forEach((entry) => {
            if (!byWord.has(entry.word)) byWord.set(entry.word, entry);
        });
        const groupOf = new Map();
        GROUPS.forEach((group) => group.words.forEach((word) => groupOf.set(word, group)));

        const stats = new Map();
        SUFFIXES.forEach(([suffix, gender]) => stats.set(suffix, {
            suffix,
            gender,
            total: 0,
            hits: 0,
            words: [],
            exceptions: []
        }));
        entries.forEach((entry) => {
            const gender = primaryGender(entry);
            if (!gender || entry.inf || groupOf.has(entry.word)) return;
            const match = matchSuffix(entry.word);
            if (!match) return;
            const rule = stats.get(match.suffix);
            rule.total += 1;
            if (gender === rule.gender) {
                rule.hits += 1;
                rule.words.push(entry);
            } else {
                rule.exceptions.push(entry);
            }
        });
        stats.forEach((rule) => {
            rule.share = rule.total ? rule.hits / rule.total : 0;
            rule.reliable = rule.total >= MIN_WORDS && rule.share >= USUAL;
        });

        function compoundHead(entry) {
            const word = entry.word;
            if (word.length < 7 || NOT_COMPOUNDS.has(word)) return null;
            for (let i = 3; i <= word.length - 3; i++) {
                const head = byWord.get(word[i].toUpperCase() + word.slice(i + 1));
                if (!head || head === entry) continue;
                const first = word.slice(0, i);
                const stem = first.replace(/(?:en|er|es|s|n)$/, "");
                const known = byWord.has(stem) || byWord.has(stem + "e") || byWord.has(first) || FIRST_PARTS.test(first);
                if (!known && (head.word.length < 5 || first.length < 4)) continue;
                return head.articles === entry.articles ? head : null;
            }
            return null;
        }

        function suffixRule(word) {
            const match = matchSuffix(word);
            if (!match) return null;
            const rule = stats.get(match.suffix);
            return rule.reliable ? rule : null;
        }

        function explain(entry) {
            const gender = primaryGender(entry);
            if (!gender) {
                return {
                    kind: "several",
                    text: entry.articles.split("").map((g) => ARTICLE[g]).join(" and ") + " are both correct for this word."
                };
            }
            const group = groupOf.get(entry.word);
            if (group && group.gender === gender) {
                return {
                    kind: "group",
                    group,
                    text: `${group.title} are ${GENDER[gender]}.`
                };
            }
            if (entry.inf) {
                return {
                    kind: "infinitive",
                    text: "A verb used as a noun is always neuter: das Essen, das Leben, das Warten."
                };
            }
            const rule = suffixRule(entry.word);
            if (rule && rule.gender === gender && rule.share >= STRONG) {
                return {
                    kind: "suffix",
                    rule,
                    text: `Nouns ending in -${rule.suffix} are ${GENDER[gender]} (${percent(rule.share)} of ${rule.total} here).`
                };
            }
            const head = compoundHead(entry);
            if (head) {
                return {
                    kind: "compound",
                    head,
                    text: `A compound takes the gender of its last part: ${ARTICLE[gender]} ${head.word}.`
                };
            }
            if (rule && rule.gender === gender) {
                return {
                    kind: "suffix",
                    rule,
                    text: `Nouns ending in -${rule.suffix} are usually ${GENDER[gender]} (${percent(rule.share)} of ${rule.total} here).`
                };
            }
            if (rule) {
                return {
                    kind: "exception",
                    rule,
                    text: `An exception: nouns ending in -${rule.suffix} are usually ${ARTICLE[rule.gender]} (${percent(rule.share)}), but this one is ${ARTICLE[gender]}.`
                };
            }
            return {
                kind: "none",
                text: "No reliable pattern for this one. Learn it together with its article."
            };
        }

        function rules() {
            return Array.from(stats.values())
                .filter((rule) => rule.reliable)
                .sort((a, b) => "fnm".indexOf(a.gender) - "fnm".indexOf(b.gender) || b.share - a.share || b.total - a.total);
        }

        function wordsForRule(id) {
            const group = GROUPS.find((g) => g.id === id);
            if (group) return entries.filter((entry) => groupOf.get(entry.word) === group);
            if (id === "infinitive") return entries.filter((entry) => entry.inf);
            const rule = stats.get(id);
            return rule ? rule.words.concat(rule.exceptions) : [];
        }

        return {
            explain,
            rules,
            groups: () => GROUPS.map((group) => Object.assign({}, group, {
                entries: entries.filter((entry) => groupOf.get(entry.word) === group)
            })),
            wordsForRule,
            matchSuffix
        };
    }

    function percent(share) {
        return `${Math.round(share * 100)}%`;
    }

    return {
        ARTICLE,
        GENDER,
        create,
        matchSuffix,
        percent
    };
});