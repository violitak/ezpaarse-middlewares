# sudoc

Enriches consultation events with [Sudoc](http://www.sudoc.abes.fr) data, especially the PPN (that identify Sudoc records)

## Headers

+ **sudoc-enrich** : Set to ``false`` to disable sudoc enrichment. Enabled by default.
+ **sudoc-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **sudoc-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: sudoc"
  -F "files[]=@access.log"
```