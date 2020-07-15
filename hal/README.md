# hal

Enriches consultation events with [HAL](https://hal.archives-ouvertes.fr/) data from their [API](https://api.archives-ouvertes.fr/docs/search)

The HAL middleware uses the ``hal-identifier`` found in the access events to request metadata using the [node-hal](https://www.npmjs.com/package/methal)

## Headers

+ **HAL-Enrich** : Set to ``true`` to enable HAL enrichment. Disabled by default.
+ **HAL-TTL** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **HAL-Throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``500``.

### Examples

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: hal"
  -F "files[]=@access.log"
```