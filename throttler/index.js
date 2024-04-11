'use strict';

/**
 * Middleware that throttle the EC stream
 */
module.exports = function throttler() {
  this.logger.verbose('Initializing throttler');

  let gap = parseInt(this.request.header('Throttling')) || 0;
  if (gap < 0) { gap = 0; }

  let buffer = [];
  let busy   = false;

  function process(done) {
    busy = true;

    setTimeout(() => {
      done();

      if (buffer.length > 0) {
        process.call(this, buffer.shift());
      } else {
        busy = false;
        this.drain();
      }
    }, gap);
  }

  return function throttle(ec, next) {
    if (gap === 0) { return next(); }

    if (busy) {
      this.saturate();
      buffer.push(next);
    } else {
      process.call(this, next);
    }
  };
};
