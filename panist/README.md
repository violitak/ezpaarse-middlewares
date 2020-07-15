# panist

Enrichment middleware that retrieves metadata from [panist](http://www.panist.fr/)

## Headers

+ **panist-enrich** : Set to ``false`` to disable PANIST enrichment. Enabled by default.
+ **panist-cache** : Enable/Disable cache.
+ **panist-license** : Set to ``true`` to get the ``license`` field as JSON. Disabled by default.
+ **panist-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **panist-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **panist-paquet-size** : Maximum number of identifiers to send for query in a single request. Defaults to ``50``.
+ **panist-buffer-size** : Maximum number of memorised access events before sending a request. Defaults to ``1000``.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: panist"
  -F "files[]=@access.log"
```