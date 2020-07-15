# enhancer

Enhances consultation events with information found in a pkb (issn, eissn, doi, title_id)

## Headers
+ **ezpaarse-enrich** : Set ``false`` to disable enrichment. Enabled by default.

### Examples

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: enhancer"
  -F "files[]=@access.log"
```

+ Disable enrichment
```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: enhancer"
  -H "ezpaarse-enrich: false"
  -F "files[]=@access.log"
```