# Outclick the Oracle

A 30-move human-vs-network game at `/tools/neural_oracle/`. The hook is testable: can a tiny, visible neural network learn your clicking habits? Three symbols, immediate feedback, a shareable escape mosaic, and daily starting weights make it easy to try and challenge someone else. Virality is an aspiration, not a promised outcome.

## Game feel

- **Sealed guess.** The Oracle's prediction sits face-down (🔒) before every click, then flips to show its pick and confidence next to yours, with an ESCAPED / PREDICTED stamp and the points earned. It re-seals 1.7 s later for the next move.
- **Visible learning.** After each click the canvas plays the forward pass (white sparks along the weights that carried signal), then backprop (gold sparks flowing backward along the weights that changed most). Its BET ring marks the predicted output.
- **Feedback.** Escapes burst particles from the clicked button and flash cyan. Predictions shake the arena and flash pink. Streaks of 3+ make the arena glow, and 5+ turns it gold. The Oracle taunts in context ("Orbit again? Of course.").
- **Sound.** Short WebAudio synth cues: click, escape arpeggio (pitch rises with the streak), "denied" buzz, end fanfare. No audio files. A toggle in the top bar is persisted under `neural-oracle-sound`. A light vibration on predicted moves fires only when sound is on.
- **Results.** Rank (Open Book → Oracle Breaker), a per-move chart of the probability it gave your actual click against a 33% blind guess, and up to four habit insights: favorite symbol, repeat rate vs. 33%, strongest transition, and early vs. late hit rate.
- **Sharing.** Native share where available, copy-to-clipboard with a selectable fallback, and a 1080×1350 PNG score card. Shared links carry `&beat=<score>`. Opening one shows the friend's score as a target and reports beat / not beaten at the end. `beat` is ignored unless `challenge` is also valid.

All motion respects `prefers-reduced-motion`. The screen-reader status line still states the factual outcome of every move.

## Teaching through play

1. Repeat a symbol to teach a pattern. Confidence rises and surprise points shrink.
2. Switch symbols to create high loss. See the correction in the weight deltas.
3. Try cycles or less predictable clicks. Compare the previous prediction with your actual choice.
4. Inspect every layer, all weights and biases, and a worked gradient for any output neuron.

The model has 9 one-hot history inputs (newest first), 8 tanh hidden neurons, and 3 softmax outputs: 107 trainable parameters. Training uses online gradient descent with cross-entropy loss and learning rate 0.22. There is no pretrained model or API. The only runtime dependency is KaTeX 0.16.9 from cdnjs (with SRI) for typesetting the lab's math; if it fails to load, every formula falls back to plain text. Tests serve the same version from the `katex` dev dependency. It is a small pattern learner, not a randomness or intelligence test.

Predictions are computed before the current choice enters the model; training follows scoring. The visualization, formulas, and weight tables show that pre-update snapshot. Deltas show the subsequent update. The lab walks the forward pass in four typeset stages (one-hot input, tanh hidden layer with a live tanh plot, softmax bet, loss and backprop), then zooms into one output neuron: its full weighted sum with real numbers, a diverging chart of each hidden neuron's vote, and one real gradient step for a weight and its bias. Weight tables are signed heatmaps; gold outlines mark the largest changes. The next prediction stays hidden, so the inspector does not give away the answer. Canvas edges show signed weights; neuron brightness shows activation magnitude. Animation runs briefly after a click and respects reduced motion.

Score per move is `round(100 * (1 - p(chosen symbol)))`. Escape means the chosen symbol differs from the highest-probability prediction. Ties use the first output, Orbit. Score and escape count are distinct: streaks do not affect score. Uniform guesses yield about 2,000 points; 3,000 is a scoring ceiling, not a typical target. Scores are informal local challenges, not verified competitive rankings.

Daily seeds use UTC dates. `?challenge=YYYY-MM-DD` preserves the initial network for a shared challenge. Restart clears learning. Model/score changes that affect reproducibility must increment the `oracle-v1` seed/storage version and retain or explicitly retire old shared challenges. Only the best score is persisted; click history stays in memory. Clipboard failure exposes a selectable text fallback.

## Repository integration and validation

Uses the existing site shell, shared tool styles/helpers, standalone `index.html` / `style.css` / `app.js` convention, and the tools directory's normal searchable card. The pure model is in `model.js` and exports to browser and CommonJS test environments.

Run `npx playwright test tests/neural-oracle.spec.js`. The tests verify numerical gradients, actual learning, deterministic replay, the 30-move boundary, mobile/desktop interaction, keyboard use, weight inspection, sharing fallbacks, friend-challenge links, score-card download, sound preference, blocked storage, and tools-directory discovery.

## Promo video

`node scripts/reels/oracle/build.js` films a 26 s vertical promo of a real game against the 2026-10-09 brain and cuts it to an original synthesized phonk track. Output goes to `scripts/reels/out/oracle-promo.mp4`. See `scripts/reels/oracle/README.md`.
