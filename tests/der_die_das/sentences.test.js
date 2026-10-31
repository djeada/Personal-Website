"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Sentences = require("../../src/tools/der_die_das/sentences.js");

test("definite and indefinite articles cover the complete declension tables", () => {
    const rows = (family) => Object.values(Sentences.FORMS[family]).map((row) => Object.values(row).join(" "));
    assert.deepEqual(rows("definite"), ["der die das die", "den die das die", "dem der dem den", "des der des der"]);
    assert.deepEqual(rows("indefinite"), ["ein eine ein", "einen eine ein", "einem einer einem", "eines einer eines"]);
    assert.deepEqual(Sentences.choices("mixed"), ["der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer", "eines"]);
});

test("every case, gender and article family has three complete, distinct contexts", () => {
    assert.equal(Sentences.exercises.length, 84);
    assert.equal(new Set(Sentences.exercises.map((entry) => entry.id)).size, 84);
    for (const family of ["definite", "indefinite"]) {
        for (const grammaticalCase of Object.keys(Sentences.CASES)) {
            for (const gender of family === "definite" ? ["m", "f", "n", "p"] : ["m", "f", "n"]) {
                const entries = Sentences.pool(family, grammaticalCase).filter((entry) => entry.gender === gender);
                assert.equal(entries.length, 3, `${family}/${grammaticalCase}/${gender}`);
                for (const entry of entries) {
                    assert.ok(entry.noun && entry.translation && entry.reason);
                    assert.match(entry.after, /^ [A-ZÄÖÜ].+[.!?]$/);
                    assert.match(Sentences.sentence(entry), /^[A-ZÄÖÜ]/);
                    assert.ok(Sentences.choices(family).includes(entry.answer));
                    assert.ok(Sentences.explain(entry).startsWith(Sentences.CASES[grammaticalCase]));
                }
            }
        }
    }
});

test("filtering preserves plural practice and never invents an indefinite plural", () => {
    assert.equal(Sentences.pool("definite").length, 48);
    assert.equal(Sentences.pool("indefinite").length, 36);
    assert.equal(Sentences.pool("mixed").length, 84);
    assert.equal(Sentences.pool("definite", "dative").filter((entry) => entry.gender === "p").length, 3);
    assert.equal(Sentences.pool("indefinite").some((entry) => entry.gender === "p"), false);
    assert.ok(Sentences.pool("mixed", "genitive").every((entry) => entry.case === "genitive"));
});

test("short rounds rotate all four cases and every definite gender without repeats", () => {
    const pool = Sentences.pool("definite");
    for (const random of [() => 0, () => 0.5, () => 0.999]) {
        const deck = Sentences.deck(pool, random);
        assert.equal(new Set(deck.map((entry) => entry.id)).size, pool.length);
        assert.deepEqual(new Set(deck.slice(0, 4).map((entry) => entry.case)), new Set(Object.keys(Sentences.CASES)));
        assert.equal(new Set(deck.slice(0, 16).map((entry) => `${entry.case}:${entry.gender}`)).size, 16);
        assert.deepEqual(new Set(deck.slice(0, 16).map((entry) => entry.answer)), new Set(Sentences.choices("definite")));
    }
    assert.equal(new Set(Sentences.deck(Sentences.pool("mixed")).slice(0, 20).map((entry) => entry.case)).size, 4);
});

test("the noun forms agree with dative plurals and masculine/neuter genitives", () => {
    const sentences = Sentences.pool("definite").map(Sentences.sentence);
    for (const example of [
        "Ich spiele mit den Kindern im Garten.",
        "Sie spricht mit den Freunden.",
        "Wir fahren mit den Autos zum See.",
        "Das Auto des Mannes steht draußen.",
        "Der Titel des Buches ist lang.",
        "Die Fahrräder der Kinder stehen im Hof."
    ]) assert.ok(sentences.includes(example), example);
    const indefinite = Sentences.pool("indefinite").map(Sentences.sentence);
    assert.ok(indefinite.includes("Ich sehe einen Mann an der Haltestelle."));
    assert.ok(indefinite.includes("Die Tür eines Hauses ist blau."));
});
