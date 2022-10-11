# datacite

Middleware that fetches metadata from the API Datasite

## Headers

+ **datacite-cache** : Enable/Disable cache.
+ **datacite-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **datacite-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``100``ms.
+ **datacite-paquet-size** : Maximum number of identifiers to send for query in a single request. Defaults to ``50``.
+ **datacite-buffer-size** : Maximum number of memorised access events before sending a request. Defaults to ``1000``.

## Enriched fields
| Name | Type | Description |
| --- | --- | --- |
| publication_title | String | Title of this resource. |

### Example :

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: datacite"
  -F "files[]=@access.log"
```
