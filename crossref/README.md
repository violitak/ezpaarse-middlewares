# crossref

Enriches consultation events with [crossref](http://search.crossref.org/) data from their [API](http://search.crossref.org/help/api)

## Headers
| Name | Type | Default | Description |
| --- | --- | --- | --- |
| crossref-enrich | Boolean | ``false`` | Disable or enable crossref enrichment |
| crossref-cache | Boolean | ``false`` | Disable or enable cache |
| crossref-license | Boolean | ``false`` | Get the ``license`` field as JSON |
| crossref-ttl | Integer | ``3600 * 24 * 7`` | Lifetime of cached documents, in seconds |
| crossref-throttle | Integer | ``200`` | Minimum time to wait between queries, in milliseconds in milliseconds |
| crossref-paquet-size | Integer | ``50`` | Maximum number of identifiers to send for query in a single request |
| crossref-buffer-size | Integer | ``1000`` | Maximum number of memorised access events before sending a request |

+ **crossref-enrich** : set to ``false`` to disable crossref enrichment. Enabled by default.
+ **crossref-cache** : Enable/Disable cache.
+ **crossref-license** : set to ``true`` to get the ``license`` field as JSON. Disabled by default.
+ **crossref-ttl** : lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **crossref-throttle** : minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **crossref-paquet-size** : maximum number of identifiers to send for query in a single request. Defaults to ``50``.
+ **crossref-buffer-size** : maximum number of memorised access events before sending a request. Defaults to ``1000``.
