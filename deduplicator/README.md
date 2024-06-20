# deduplicator

Removes duplicate consultation events, based on the COUNTER algorithm for double-clicks.

**This middleware is activated by default.**

## Prerequisites

**You must use deduplicator after filter middleware.**

## Headers

+ **double-click-strategy**
+ **double-click-removal**
+ **double-click-mixed**

## How to use

### ezPAARSE admin interface

You can add or remove deduplicator by default to all your enrichments, To do this, go to the middleware section of administration.

![image](./docs/admin-interface.png)

### ezPAARSE process interface

You can use deduplicator for an enrichment process. You just add the middleware.

![image](./docs/process-interface.png)

### ezp

```bash
# enrich with one file
ezp process <path of your file> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: deduplicator" \
  --out ./result.csv

# enrich with multiples files
ezp bulk <path of your directory> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: deduplicator" \

```

### curl

```bash
curl -X POST -v http://localhost:59599 \
  -H "ezPAARSE-Middlewares: deduplicator" \
  -H "Log-Format-Ezproxy: <line format>" \
  -F "file=@<log file path>"

```
