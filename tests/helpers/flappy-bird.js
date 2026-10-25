// Drive only the game's animation callbacks. The DOM, canvas and input events
// remain real, while frame cadence and long sessions are deterministic.
async function installFlightDriver(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.addInitScript(() => {
    Math.random = () => .5;
    const nativeRequest = window.requestAnimationFrame.bind(window);
    const nativeCancel = window.cancelAnimationFrame.bind(window);
    const pending = new Map();
    let sequence = 0;
    let timestamp = 0;
    const driver = window.flightDriver = {
      frames: 0, draws: 0, totalDraws: 0, birdY: 288, previousY: 288,
      get pending() { return pending.size; },
      step(milliseconds = 1000 / 60) {
        timestamp += milliseconds;
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) {
          this.frames++;
          this.previousY = this.birdY;
          callback(timestamp);
        }
      },
      advance(frames, hz = 60, autopilot = false) {
        for (let frame = 0; frame < frames; frame++) {
          if (autopilot && this.birdY > 305 && this.birdY >= this.previousY) {
            document.querySelector('#canvas').dispatchEvent(new KeyboardEvent('keydown', {
              key: ' ', code: 'Space', bubbles: true
            }));
          }
          this.step(1000 / hz);
        }
      }
    };
    window.requestAnimationFrame = callback => {
      if (callback.name !== 'loop') return nativeRequest(callback);
      const id = --sequence;
      pending.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = id => {
      if (id < 0) pending.delete(id);
      else nativeCancel(id);
    };
    for (const name of ['fillRect', 'strokeRect', 'drawImage', 'fill', 'stroke']) {
      const original = CanvasRenderingContext2D.prototype[name];
      CanvasRenderingContext2D.prototype[name] = function(...args) {
        driver.totalDraws++;
        if (this.canvas.id === 'canvas') driver.draws++;
        return original.apply(this, args);
      };
    }
    const translate = CanvasRenderingContext2D.prototype.translate;
    CanvasRenderingContext2D.prototype.translate = function(x, y) {
      if (this.canvas.id === 'canvas' && x === 220) driver.birdY = y;
      return translate.call(this, x, y);
    };
  });
}

async function openFlight(page) {
  await page.goto('/tools/flappy_bird/', { waitUntil: 'load' });
  await page.evaluate(() => flightDriver.step());
}

module.exports = { installFlightDriver, openFlight };
