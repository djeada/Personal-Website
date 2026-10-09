"use strict";

/*
 * One timeline drives both the picture and the soundtrack, so every cut, caption
 * slam and click lands on the beat grid the music is written to.
 *
 * The game itself is not scripted: the clicks are. The first OPENING clicks repeat
 * Orbit so the Oracle grows confident, then every click picks the symbol the real
 * network rates least likely. The outcome of each move is replayed here with the
 * same model.js the page runs, so captions can quote real numbers.
 */

const { Game } = require("../../../src/tools/neural_oracle/model.js");

const FPS = 30;
const BPM = 120;
const BEAT = 60 / BPM;
const DURATION = 26;
const CHALLENGE = "2026-10-09";
const OPENING = 6;

const moveTimes = [
    ...[0, 1, 2, 3, 4, 5].map(i => 4 + i * BEAT / 2),
    8,
    ...Array.from({ length: 12 }, (_, i) => 10 + i * BEAT),
    ...Array.from({ length: 11 }, (_, i) => 16 + i * BEAT / 2)
];

function replay() {
    const game = new Game(`oracle-v1:${CHALLENGE}`);
    return moveTimes.map((t, i) => {
        const p = game.network.forward(game.input()).probabilities;
        const choice = i < OPENING ? 0 : p.indexOf(Math.min(...p));
        const result = game.play(choice);
        return {
            t, index: i + 1, choice, key: String(choice + 1),
            escaped: result.escaped, points: result.points,
            confidence: result.snapshot.probabilities[result.prediction],
            streak: game.streak, score: game.score,
            caught: game.results.filter(r => !r.escaped).length
        };
    });
}

function build() {
    const moves = replay();
    const at = t => moves.filter(m => m.t <= t + 1e-6).pop();
    const turn = moves[OPENING];
    const final = moves[moves.length - 1];
    const sure = Math.round(turn.confidence * 100);
    const fmt = n => n.toLocaleString("en-US");

    // pos: vertical anchor of the caption block as a fraction of the frame height.
    const captions = [
        { t: 0.0, end: 0.5, lines: ["YOU THINK"], pos: .42 },
        { t: 0.5, end: 1.0, lines: ["YOU THINK", "YOU'RE"], pos: .42 },
        { t: 1.0, end: 2.0, lines: ["YOU THINK", "YOU'RE", "<em>RANDOM?</em>"], pos: .42 },
        { t: 2.0, end: 2.5, lines: ["THIS"], pos: .5 },
        { t: 2.5, end: 3.0, lines: ["THIS", "NEURAL NET"], pos: .5 },
        { t: 3.0, end: 3.9, lines: ["THIS", "NEURAL NET", "<em>DISAGREES.</em>"], pos: .5 },
        { t: 4.0, end: 5.0, lines: ["IT <em>WATCHES.</em>"], pos: .16 },
        { t: 5.0, end: 6.0, lines: ["IT <em>LEARNS.</em>"], pos: .16 },
        { t: 6.0, end: 7.0, lines: ["IT <em>PREDICTS.</em>"], pos: .16 },
        { t: 7.0, end: 7.5, lines: ["ORACLE:", `<em>${sure}% SURE</em>`], pos: .2, size: .9 },
        { t: 7.5, end: 8.0, lines: ["ME:"], pos: .2 },
        { t: 8.1, end: 9.0, lines: ["NOT", "<em>TODAY.</em>"], pos: .2 },
        { t: 9.0, end: 10.0, lines: ["IT REWIRES", "<em>ITSELF</em>"], pos: .16, size: .85 },
        { t: 10.0, end: 11.0, lines: ["IT ADAPTS."], pos: .16 },
        { t: 11.0, end: 12.0, lines: ["I ADAPT", "<em>FASTER.</em>"], pos: .16 },
        { t: 13.0, end: 14.0, lines: ["IT CAN'T", "<em>READ ME.</em>"], pos: .16 },
        { t: 15.0, end: 16.0, lines: [`<em>${at(15).streak}</em> IN A ROW.`], pos: .2 },
        { t: 16.0, end: 17.0, lines: ["107", "<em>PARAMETERS</em>"], pos: .16 },
        { t: 17.0, end: 18.0, lines: ["ZERO", "<em>CLUE.</em>"], pos: .16 },
        { t: 19.0, end: 20.0, lines: [`<em>${fmt(final.score)}</em>`, "POINTS"], pos: .2, size: 1.2 },
        { t: 20.0, end: 21.0, lines: ["ORACLE HIT RATE:", `<em>${Math.round(final.caught / 30 * 100)}%</em>`], pos: .2, size: .85 },
        { t: 21.0, end: 22.0, lines: ["“I HATE THAT.”", "<small>— THE ORACLE</small>"], pos: .2, size: .85 },
        { t: 22.0, end: 23.0, lines: ["YOU THINK", "YOU'RE", "<em>RANDOM?</em>"], pos: .42 },
        { t: 23.0, end: 24.0, lines: ["<em>PROVE IT.</em>"], pos: .45, size: 1.25 }
    ];

    // Camera shots are hard cuts. zoom is the page scale; the target is centred at height fraction y.
    const shots = [
        { t: 0, target: "#network", zoom: 1.15, y: .62, drift: .08 },
        { t: 2.0, target: ".oracle-stats", zoom: 1.3, y: .78, drift: .05 },
        { t: 4.0, target: ".oracle-duel", zoom: 1.3, y: .62 },
        { t: 4.5, target: ".oracle-choices", zoom: 1.35, y: .62 },
        { t: 5.0, target: "#network", zoom: 1.08, y: .62 },
        { t: 5.5, target: ".oracle-duel", zoom: 1.35, y: .62 },
        { t: 6.0, target: "#network", zoom: 1.08, y: .62, drift: .08 },
        { t: 6.5, target: ".oracle-stats", zoom: 1.4, y: .62 },
        { t: 7.0, target: "#guess-card", zoom: 2.4, y: .6, drift: .12 },
        { t: 7.5, target: '[data-choice="2"]', zoom: 2.2, y: .6, drift: .15 },
        { t: 8.0, target: ".oracle-duel", zoom: 1.55, y: .6, drift: .1 },
        { t: 9.0, target: "#network", zoom: 1.08, y: .6, drift: .05 },
        { t: 10.0, target: ".oracle-stats", zoom: 1.35, y: .6 },
        { t: 10.5, target: ".oracle-duel", zoom: 1.3, y: .62 },
        { t: 11.0, target: "#network", zoom: 1.08, y: .62 },
        { t: 11.5, target: ".oracle-choices", zoom: 1.3, y: .62 },
        { t: 12.0, target: ".oracle-duel", zoom: 1.3, y: .62 },
        { t: 12.5, target: "#history", zoom: 1.25, y: .62 },
        { t: 13.0, target: ".oracle-duel", zoom: 1.3, y: .62 },
        { t: 14.0, target: "#network", zoom: 1.08, y: .6, drift: .06 },
        { t: 14.5, target: ".oracle-choices", zoom: 1.3, y: .6 },
        { t: 15.0, target: ".oracle-stats", zoom: 1.4, y: .6 },
        { t: 16.0, target: "#network", zoom: 1.08, y: .6 },
        { t: 16.5, target: ".oracle-arena", zoom: 1.0, y: .56, anchor: .38 },
        { t: 17.0, target: ".oracle-duel", zoom: 1.3, y: .62 },
        { t: 18.0, target: "#history", zoom: 1.3, y: .6 },
        { t: 19.0, target: "#result-title", zoom: 1.0, y: .55, drift: .05 },
        { t: 20.0, target: "#confidence-chart", zoom: 1.1, y: .6 },
        { t: 21.0, target: ".oracle-duel", zoom: 1.3, y: .6, drift: .06 }
    ];

    // Ranges where the footage goes black and white, and where game time slows down.
    const mono = [[0, 4], [7, 9], [19, 19.5], [22, DURATION]];
    const slow = [[8.0, 9.0, .35]];
    const endCard = 22.0;

    return { FPS, BPM, BEAT, DURATION, CHALLENGE, moves, captions, shots, mono, slow, endCard, final };
}

module.exports = { build };

if (require.main === module) {
    const timeline = build();
    console.log(timeline.moves.map(m => `${m.t.toFixed(2)}s #${m.index} ${"OPS"[m.choice]} ${m.escaped ? "ESC" : "hit"} +${m.points} streak ${m.streak} conf ${Math.round(m.confidence * 100)}%`).join("\n"));
    console.log("final", timeline.final.score, "caught", timeline.final.caught);
}
