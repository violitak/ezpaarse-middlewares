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
    if (typeof lastCallback === 'function') {
      this.logger.error('Received an EC after termination signal');
    }
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

    let maxGroupSize = 0;

    function fullPacket () {
      if (typeof groupBy === 'function') {
        return maxGroupSize >= packetSize;
      }
      return packet.ecs.length >= packetSize;
    }

    while (!fullPacket()) {
      const [ec, done] = buffer.shift() || [];

      if (!ec) { break; }

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
        const groupId = groupBy(ec);
        const group = packet.groups.get(groupId);

        if (group) {
          group.push([ec, done]);
          maxGroupSize = Math.max(maxGroupSize, group.length);
        } else {
          packet.groups.set(groupId, [[ec, done]]);
          maxGroupSize = Math.max(maxGroupSize, 1);
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
