# unpaywall

The Unpaywall middleware uses the ``DOI`` found in access events to request Open Acess metadata using the Unpaywall API. Limited to ``100 000`` DOIs per day.

## Headers

+ **unpaywall-cache** : Set to ``false`` to disable result caching. Enabled by default.
+ **unpaywall-TTL** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``
+ **unpaywall-throttle** : Minimum time to wait between each packet of queries, in milliseconds. Defaults to ``100``ms
+ **unpaywall-paquet-size** : Maximum number of DOIs to request in parallel. Defaults to ``10``
+ **unpaywall-buffer-size** : Maximum number of memorised access events before sending requests. Defaults to ``200``
+ **unpaywall-email** : The email to use for API calls. Defaults to ``YOUR_EMAIL``.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: unpaywall"
  -F "files[]=@access.log"
```