# istex

Enriches consultation events with [istex](http://www.istex.fr/) data from their [API](https://api.istex.fr/documentation/)

The ISTEX middleware uses the ``istex-identifier`` found in the access events to request metadata using the [node-istex](hhttps://www.npmjs.com/package/node-istex)

ISTEX middleware is automatically activated on ISTEX logs

## Headers

+ **istex-enrich** : Set to ``true`` to enable ISTEX enrichment. Disabled by default.
+ **istex-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **istex-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``500``.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: istex"
  -F "files[]=@access.log"
```