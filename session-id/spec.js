'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const timestamp = '1557058490';
const datetime = new Date(timestamp * 1000); // 2019-05-05T12:14:50.000Z

const year = datetime.getFullYear();
const month = (datetime.getMonth() + 1).toString().padStart(2, 0);
const day = (datetime.getDate()).toString().padStart(2, 0);

// The date/hour in the generated session ID depends on timezone
const date = `${year}-${month}-${day}`;
const hour = datetime.getHours().toString().padStart(2, 0);

const tests = [
  {
    label: 'uses login if any',
    fields: null,
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      login: 'john.doo',
      date,
      timestamp
    },
    sessionId: {
      name: 'session_id',
      value: `${date}|${hour}|john.doo`
    },
    userId: {
      name: 'user_id',
      value: 'john.doo'
    }
  },
  {
    label: 'uses host and user agent if both are set',
    fields: null,
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      date,
      timestamp
    },
    sessionId: {
      name: 'session_id',
      value: `${date}|${hour}|140.128.66.101|mozilla`
    },
    userId: {
      name: 'user_id',
      value: '140.128.66.101|mozilla'
    }
  },
  {
    label: 'uses host if user agent is not set',
    fields: null,
    ec: {
      host: '140.128.66.101',
      date,
      timestamp
    },
    sessionId: {
      name: 'session_id',
      value: `${date}|${hour}|140.128.66.101`
    },
    userId: {
      name: 'user_id',
      value: '140.128.66.101'
    }
  },
  {
    label: 'handles custom user, user ID and session fields',
    fields: 'user:user, userid: uid, session:sid',
    ec: {
      host: '140.128.66.101',
      'user-agent': 'mozilla',
      user: 'john.doo',
      date,
      timestamp
    },
    sessionId: {
      name: 'sid',
      value: `${date}|${hour}|john.doo`
    },
    userId: {
      name: 'uid',
      value: 'john.doo'
    }
  },
  {
    label: 'handles custom host and user agent fields',
    fields: 'host:ip, useragent:ua',
    ec: {
      ip: '140.128.66.101',
      ua: 'mozilla',
      date,
      timestamp
    },
    sessionId: {
      name: 'session_id',
      value: `${date}|${hour}|140.128.66.101|mozilla`
    },
    userId: {
      name: 'user_id',
      value: '140.128.66.101|mozilla'
    }
  },
];

describe('session-id', () => {
  for (const { label, fields, ec, sessionId, userId } of tests) {
    it(label, async () => {
      const process = await contextify(mw, ctx => {
        if (fields) {
          ctx.request.headers['session-id-fields'] = fields;
        }
      });
      await new Promise(resolve => process(ec, resolve));

      expect(ec).to.have.property(sessionId.name, sessionId.value);
      expect(ec).to.have.property(userId.name, userId.value);
    });
  }
});
