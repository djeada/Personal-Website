# Outclick the Oracle

A 30-move human-vs-network game at `/tools/neural_oracle/`. The hook is testable: can a tiny, visible neural network learn your clicking habits? Three symbols, immediate feedback, a shareable escape mosaic, and daily starting weights make it easy to try and challenge someone else. Virality is an aspiration, not a promised outcome.

## Teaching through play

1. Repeat a symbol to teach a pattern. Confidence rises and surprise points shrink.
2. Switch symbols to create high loss. See the correction in the weight deltas.
3. Try cycles or less predictable clicks. Compare the previous prediction with your actual choice.
4. Inspect every layer, all weights and biases, and a worked gradient for any output neuron.

The model has 9 one-hot history inputs (newest first), 8 tanh hidden neurons, and 3 softmax outputs: 107 trainable parameters. Training uses online gradient descent with cross-entropy loss and learning rate 0.22. There is no pretrained model, API, or added runtime dependency. It is a small pattern learner, not a randomness or intelligence test.

Predictions are computed before the current choice enters the model; training follows scoring. The visualization, formulas, and weight tables show that pre-update snapshot. Deltas show the subsequent update. The next prediction stays hidden, so the inspector does not give away the answer. Canvas edges show signed weights; neuron brightness shows activation magnitude. Animation runs briefly after a click and respects reduced motion.

Score per move is `round(100 * (1 - p(chosen symbol)))`. Escape means the chosen symbol differs from the highest-probability prediction. Ties use the first output, Orbit. Score and escape count are distinct: streaks do not affect score. Uniform guesses yield about 2,000 points; 3,000 is a scoring ceiling, not a typical target. Scores are informal local challenges, not verified competitive rankings.

Daily seeds use UTC dates. `?challenge=YYYY-MM-DD` preserves the initial network for a shared challenge. Restart clears learning. Model/score changes that affect reproducibility must increment the `oracle-v1` seed/storage version and retain or explicitly retire old shared challenges. Only the best score is persisted; click history stays in memory. Clipboard failure exposes a selectable text fallback.

## Repository integration and validation

Uses the existing site shell, shared tool styles/helpers, standalone `index.html` / `style.css` / `app.js` convention, and the tools directory's normal searchable card. The pure model is in `model.js` and exports to browser and CommonJS test environments.

Run `npx playwright test tests/neural-oracle.spec.js`. The tests verify numerical gradients, actual learning, deterministic replay, the 30-move boundary, mobile/desktop interaction, keyboard use, weight inspection, sharing fallbacks, blocked storage, and tools-directory discovery.
