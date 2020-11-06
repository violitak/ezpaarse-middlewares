# zotero

Enriches consultation events with [zotero]

## Headers

+ **zotero-enrich** : Set to ``false`` to disable zotero enrichment. Enabled by default.
+ **zotero-cache** : Enable/Disable cache.
+ **zotero-license** : Set to ``true`` to get the ``license`` field as JSON. Disabled by default.
+ **zotero-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **zotero-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **zotero-paquet-size** : Maximum number of identifiers to send for query in a single request. Defaults to ``50``.
+ **zotero-buffer-size** : Maximum number of memorised access events before sending a request. Defaults to ``1000``.

### Example :

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: zotero"
  -F "files[]=@access.log"
```