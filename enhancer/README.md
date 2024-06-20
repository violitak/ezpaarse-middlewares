# enhancer

Enhances consultation events with information found in a pkb (issn, eissn, doi, title_id).

**This middleware is activated by default.**

## Headers

## Prerequisites

**You must use enhancer after filter, parser, deduplicator middleware.**

+ **ezpaarse-enrich** : Set ``false`` to disable enrichment. Enabled by default.

## How to use

### ezPAARSE admin interface

You can add or remove enhancer by default to all your enrichments, To do this, go to the middleware section of administration.

![image](./docs/admin-interface.png)

### ezPAARSE process interface

You can use enhancer for an enrichment process. You just add the middleware.

![image](./docs/process-interface.png)

### ezp

```bash
# enrich with one file
ezp process <path of your file> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: enhancer" \
  --out ./result.csv

# enrich with multiples files
ezp bulk <path of your directory> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: enhancer" \

```

### curl

```bash
curl -X POST -v http://localhost:59599 \
  -H "ezPAARSE-Middlewares: enhancer" \
  -H "Log-Format-Ezproxy: <line format>" \
  -F "file=@<log file path>"

```
