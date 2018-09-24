exports.contextify = function (middleware) {
  const ctx = {
    request: {
      header () {}
    },
    response: {
      header () {}
    },
    logger: {
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
    }
  };

  return middleware.call(ctx);
};
