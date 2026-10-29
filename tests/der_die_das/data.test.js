"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const data = require("../../src/tools/der_die_das/words.json");
const Rules = require("../../src/tools/der_die_das/rules.js");

const entries = data.words.map(([word, articles, plural, meaning, level, extra = {}]) => ({ word, articles, plural, meaning, level, inf: Boolean(extra.i), extra }));
const find = (word, articles) => entries.find((e) => e.word === word && (!articles || e.articles === articles));

test("every noun has an article, a meaning and a level", () => {
    assert.ok(entries.length >= 5000, `only ${entries.length} nouns`);
    for (const e of entries) {
        assert.match(e.articles, /^(?:m|f|n|mf|mn|fn|mfn)$/, e.word);
        assert.ok(e.meaning && e.meaning.length <= 60, `${e.word}: "${e.meaning}"`);
        assert.ok([1, 2, 3, 4].includes(e.level), e.word);
        assert.match(e.word, /^[A-ZÄÖÜ]/, e.word);
    }
});

test("homographs carry the meaning that decides the article", () => {
    assert.equal(find("See", "m").meaning, "lake");
    assert.equal(find("See", "f").meaning, "sea");
    assert.equal(find("Schild", "n").meaning, "sign");
    assert.equal(find("Leiter", "f").meaning, "ladder");
    for (const e of entries.filter((x) => x.extra.d)) {
        const others = entries.filter((x) => x.word === e.word && x !== e);
        others.forEach((o) => assert.notEqual(o.meaning, e.meaning, e.word));
    }
});

test("known errors in the old list stay fixed", () => {
    assert.equal(find("Hut", "m").plural, "Hüte");
    assert.equal(find("Mangel", "m").plural, "Mängel");
    assert.equal(find("Tor", "n").plural, "Tore");
    assert.equal(find("Zug").meaning, "train");
    assert.equal(find("Monat").articles, "m");
    assert.equal(find("Liter").articles, "mn");
    assert.equal(find("Cola").extra.v, "n");
    for (const word of ["Habe", "Des", "Als", "Nutte", "ABGB"]) assert.equal(find(word), undefined, word);
});

test("the beginner levels are everyday words", () => {
    const first = new Set(entries.filter((e) => e.level === 1).map((e) => e.word));
    for (const word of ["Mann", "Frau", "Kind", "Haus", "Zeit", "Tag", "Wasser", "Tisch", "Zeitung", "Lehrer"]) {
        assert.ok(first.has(word), word);
    }
});

test("rules explain words from their ending, their last part or their meaning group", () => {
    const rules = Rules.create(entries);
    assert.equal(rules.explain(find("Zeitung")).kind, "suffix");
    assert.equal(rules.explain(find("Mädchen")).kind, "suffix");
    assert.equal(rules.explain(find("Montag")).kind, "group");
    assert.equal(rules.explain(find("Essen")).kind, "infinitive");
    const desk = rules.explain(find("Schreibtisch"));
    assert.equal(desk.kind, "compound");
    assert.equal(desk.head.word, "Tisch");
    const name = rules.explain(find("Name"));
    assert.equal(name.kind, "exception");
    assert.match(name.text, /-e are usually die/);
    assert.equal(rules.explain(find("Kontrolle")).kind === "compound", false);
});

test("only reliable rules are offered, and -ung is nearly always feminine", () => {
    const rules = Rules.create(entries).rules();
    const ung = rules.find((r) => r.suffix === "ung");
    assert.ok(ung.share > 0.97 && ung.total > 200);
    for (const rule of rules) assert.ok(rule.share >= 0.75 && rule.total >= 8, rule.suffix);
});
