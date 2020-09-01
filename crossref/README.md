# crossref

Enriches consultation events with [crossref](http://search.crossref.org/) data from their [API](http://search.crossref.org/help/api)

## Headers

+ **crossref-enrich** : Set to ``false`` to disable crossref enrichment. Enabled by default.
+ **crossref-cache** : Enable/Disable cache.
+ **crossref-license** : Set to ``true`` to get the ``license`` field as JSON. Disabled by default.
+ **crossref-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **crossref-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **crossref-paquet-size** : Maximum number of identifiers to send for query in a single request. Defaults to ``50``.
+ **crossref-buffer-size** : Maximum number of memorised access events before sending a request. Defaults to ``1000``.

### Example :

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: crossref"
  -F "files[]=@access.log"
```