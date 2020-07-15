# robots

Generates a file (``robots.json``) which contains a list of trackcodes that have done N lookups and appear to be robots.

## Headers

+ **robots-ttl** : Lifetime of cached documents, in seconds. Defaults to ``1 day (3600 * 24)``.
+ **robots-threshold** : Maximum threshold. Defaults to ``100``.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: robots"
  -F "files[]=@access.log"
```