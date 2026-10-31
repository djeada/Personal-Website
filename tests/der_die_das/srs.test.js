"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Srs = require("../../src/tools/der_die_das/srs.js");

const words = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, word: `W${i}` }));

test("correct answers space reviews out and a mistake brings the word back today", () => {
    const progress = Srs.blank();
    let state = Srs.record(progress, "w0", true, 100);
    assert.equal(state.due, 101);
    state = Srs.record(progress, "w0", true, 101);
    assert.equal(state.due, 104);
    state = Srs.record(progress, "w0", false, 104);
    assert.equal(state.step, 0);
    assert.equal(state.due, 104);
    assert.equal(Srs.status(progress, "w0", 104), "difficult");
    assert.deepEqual(progress.days[104], [1, 0]);
});

test("a plan puts due reviews first, mixes in new words and respects the session size", () => {
    const progress = Srs.blank();
    for (let i = 0; i < 5; i++) Srs.record(progress, `w${i}`, true, 10);
    const plan = Srs.plan(words, progress, 11, { size: 10, newWords: 4 });
    assert.equal(plan.reviews, 5);
    assert.equal(plan.fresh, 4);
    assert.equal(plan.items.length, 9);
    assert.equal(plan.dueTotal, 5);
    assert.ok(Number(plan.items[0].id.slice(1)) < 5, "a review comes first");
    assert.equal(plan.items.filter((item) => Number(item.id.slice(1)) < 5).length, 5);
    const later = Srs.plan(words, progress, 10, { size: 10, newWords: 0 });
    assert.equal(later.items.length, 0);
});

test("a wrong answer is asked again a few cards later and only the first answer is recorded", () => {
    const session = new Srs.Session(words.slice(0, 5));
    assert.equal(session.answer(false), true);
    assert.equal(session.queue[3].id, "w0");
    session.answer(true);
    session.answer(true);
    session.answer(true);
    assert.equal(session.isRetry(), true);
    assert.equal(session.answer(true), false);
    session.answer(true);
    assert.equal(session.finished(), true);
    assert.equal(session.history.length, 5);
    assert.equal(session.history[0].correct, false);
});

test("the streak counts consecutive days with answers", () => {
    const progress = Srs.blank();
    [7, 8, 9].forEach((day) => Srs.record(progress, "w1", true, day));
    assert.equal(Srs.streak(progress, 9), 3);
    assert.equal(Srs.streak(progress, 10), 3);
    assert.equal(Srs.streak(progress, 11), 0);
});

test("the weakest words are the ones missed most recently", () => {
    const progress = Srs.blank();
    Srs.record(progress, "w1", false, 5);
    Srs.record(progress, "w2", false, 8);
    Srs.record(progress, "w3", true, 8);
    assert.deepEqual(Srs.weakest(words, progress, 5).map((w) => w.id), ["w2", "w1"]);
});
