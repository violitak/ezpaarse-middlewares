/* eslint max-len: 0 */
'use strict';

const { contextify } = require('../mock');
const mw = require('.');
const { expect } = require('chai');

const bots = [
  'CCBot/2.0 (http://commoncrawl.org/faq/)',
  'curl/7.19.7 (x86_64-redhat-linux-gnu) libcurl/7.19.7 NSS/3.19.1 Basic ECC zlib/1.2.3 libidn/1.18 libssh2/1.4.2',
  'Googlebot/2.1 (+http://www.google.com/bot.html)',
  'Java 1.7 Apache HttpClient (Linux x86_64) / GnowitNewsbot / Contact information at http://www.gnowit.com',
  'Java/1.8.0_45',
  'magpie-crawler/1.1 (U; Linux amd64; en-GB; +http://www.brandwatch.net)',
  'Mediatoolkitbot (complaints@mediatoolkit.com)',
  'Mozilla/4.0 (compatible; MSIE 5.5; Windows 98; Win 9x 4.90; KITV4.6 Wanadoo)',
  'Mozilla/5.0 (compatible; DotBot/1.1; http://www.opensiteexplorer.org/dotbot, help@moz.com)',
  'Mozilla/5.0 (compatible; ToutiaoSpider/1.0; http://web.toutiao.com/media_cooperation/;)',
  'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
  'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)',
  'Mozilla/5.0 Compatible Custom-Crawler/20140709',
  'Ruby',
  'ScooperBot www.customscoop.com',
  'Screaming Frog SEO Spider/6.2',
  'SemanticScholarBot/1.0 (+http://s2.allenai.org/bot.html)',
  'Sogou web spider/4.0(+http://www.sogou.com/docs/help/webmasters.htm#07)',
  'Traackr.com',
  'Wget/1.18 (linux-gnu)',
  'WordPress/4.3.8; http://normalerections.info'
];

const browsers = [
  'Mozilla/4.0 (compatible; MSIE 6.0;Plagium;)',
  'Mozilla/5.0 (iPad; CPU OS 5_1_1 like Mac OS X) AppleWebKit/534.46 (KHTML, like Gecko) Version/5.1 Mobile/9B206 Safari/7534.48.3',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 9_2_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13D15 Safari/601.1',
  'Mozilla/5.0 (Linux; Android 4.4.2; BLU LIFE PLAY MINI Build/KOT49H) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36',
  'Mozilla/5.0 (SymbianOS/9.4; Series60/5.0 Nokia5233/51.1.002; Profile/MIDP-2.1 Configuration/CLDC-1.1 ) AppleWebKit/533.4 (KHTML, like Gecko) NokiaBrowser/7.3.1.33 Mobile Safari/533.4 3gpp-gba',
  'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:38.0) Gecko/20100101 Firefox/38.0',
  'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
  'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:42.0) Gecko/20100101 Firefox/42.0',
  'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-GB; rv:1.7.6) Gecko/20050321 Firefox/1.0.2',
  'Mozilla/5.0 (X11; U; Linux i686; de; rv:1.9.1) Gecko/20090624 Firefox/3.5',
  'Opera/7.50 (Windows XP; U)',
  'Opera/9.80 (Android; Opera Mini/7.5.35199/57.135; U; en) Presto/2.12.423 Version/12.16'
];

let process;
describe('user-agent-parser', () => {
  before(() => contextify(mw).then(cb => { process = cb; }));

  it('should detect common bots', () => {
    bots.forEach(ua => {
      const ec = { 'user-agent': ua };
      process(ec, () => {});
      expect(ec).to.have.property('robot', 'yes', `expected '${ua}' to have property 'robot' of 'yes', but got ${ec.robot}`);
    });
  });

  it('should not mark common browsers as bots', () => {
    browsers.forEach(ua => {
      const ec = { 'user-agent': ua };
      process(ec, () => {});
      expect(ec).to.have.property('robot', 'no', `expected '${ua}' to have property 'robot' of 'no', but got ${ec.robot}`);
    });
  });
});
