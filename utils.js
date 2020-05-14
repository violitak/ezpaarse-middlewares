'use strict';

const co = require('co');

exports.bufferedProcess = function (mw, options) {
  options = options || {};

  let bufferSize   = parseInt(options.bufferSize);
  let packetSize   = parseInt(options.packetSize);
  let filter       = options.filter;
  let groupBy      = options.groupBy;
  let onPacket     = options.onPacket;
  let lastCallback = null;
  let busy         = false;
  let buffer       = [];

  if (typeof groupBy === 'string') {
    const field = groupBy;
    groupBy = (ec) => ec[field];
  } else if (typeof groupBy !== 'function') {
    groupBy = null;
  }

  if (isNaN(bufferSize) || bufferSize < 1) {
    bufferSize = 1000;
  }
  if (isNaN(packetSize) || packetSize < 1) {
    packetSize = 50;
  }

  return function process (ec, next) {
    if (!ec) {
      lastCallback = next;

      if (!busy) {
        drainBuffer()
          .then(() => { lastCallback(); })
          .catch(err => {
            mw.logger.error(err.message);
            mw.job._stop(err);
          });
      }
      return;
    }

    buffer.push([ec, next]);

    if (buffer.length > bufferSize && !busy) {
      busy = true;
      mw.saturate();

      drainBuffer().then(() => {
        busy = false;
        mw.drain();

        if (typeof lastCallback === 'function') { lastCallback(); }
      }).catch(err => {
        mw.logger.error(err.message);
        mw.job._stop(err);
      });
    }
  };

  /**
   * Create a packet by pulling ECs from the buffer
   */
  function* getPacket () {
    const packet = {
      ecs: [],
      groups: new Map()
    };

    function fullPacket () {
      if (typeof groupBy === 'function') {
        return packet.groups.size >= packetSize;
      }
      return packet.ecs.length >= packetSize;
    }

    while (!fullPacket()) {
      const [ec, done] = buffer.shift() || [];
      if (!ec) { return packet; }
      if (typeof filter === 'function') {
        try {
          let keep = filter(ec);

          if (keep instanceof Promise) {
            keep = yield keep;
          }

          if (!keep) {
            done();
            continue;
          }
        } catch (e) {
          done(e);
          continue;
        }

      }

      if (typeof groupBy === 'function') {
        const group = groupBy(ec);

        if (!packet.groups.has(group)) {
          packet.groups.set(group, [ec]);
        } else {
          packet.groups.get(group).push(ec);
        }
      }

      packet.ecs.push([ec, done]);
    }

    return packet;
  }

  /**
   * Create and process packets until the buffer size is low enough or there's nothing left
   */
  function drainBuffer () {
    return co(function* () {
      while (buffer.length >= bufferSize || (lastCallback && buffer.length > 0)) {
        const packet = yield getPacket();
        const res = onPacket(packet);
        if (res instanceof Promise) {
          yield res;
        }
      }
    });
  }
};

/**
 * Wait a given amount of time (used to throttle queries to the API)
 * @param {Integer} ms time to wait in milliseconds
 */
exports.wait = function wait(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms); });
};
