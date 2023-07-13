'use strict';

exports.contextify = function (middleware, contextModifier) {

  const report = {};

  let ctx = {
    request: {
      headers: {},
      header (name) { return ctx.request.headers[name.toLowerCase()]; }
    },
    response: {
      header () {}
    },
    logger: {
      silly () {},
      info () {},
      verbose () {},
      warn () {},
      error () {},
    },
    job: {
      outputFields: {
        added: [],
        removed: []
      },
      filters: {
        robots: false
      }
    },
    report: {
      getJson() {
        return report;
      },
      set(group, entry, value) {
        if (!report[group]) { report[group] = {}; }
        report[group][entry] = value;
      },
      get(group, entry) {
        return report[group] && report[group][entry];
      },
      inc(group, entry) {
        if (!report[group]) { report[group] = {}; }
        var count = report[group][entry];
        report[group][entry] = (typeof count === 'number') ? count + 1 : 1;
      },
    },
    saturate () {},
    drain () {},
  };

  if (typeof contextModifier === 'function') {
    contextModifier(ctx);
  }

  return middleware.call(ctx);
};

function cache(collectionName) {
  const items = new Map();

  const cacheObject = {
    collection: null
  };

  cacheObject.checkIndexes = function (ttl, callback) {
    callback();
  };

  cacheObject.set = function (id, doc, callback) {
    items.set(id, {
      date: new Date(),
      id: id,
      data: doc
    });
    callback();
  };

  cacheObject.get = function (id, callback) {
    const item = items.get(id);
    callback(null, item && item.data);
  };

  return cacheObject;
}

global.ezpaarse = {};
global.ezpaarse.config = {};

const libs = { cache };
global.ezpaarse.lib = function (name) {
  return libs[name];
};
