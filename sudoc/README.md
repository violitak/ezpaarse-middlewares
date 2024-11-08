# sudoc

Fetches [Sudoc](http://www.sudoc.abes.fr) data, especially the PPN (that identify Sudoc records).

**This middleware is activated by default.**

## Enriched fields

| Name | Type | Description |
| --- | --- | --- |
| sudoc-ppn  | String | unique identifier used to precisely identify a bibliographic record in the Sudoc catalog. |

## Prerequisites

Your EC needs a print_identifier for enrichment. 

**You must use sudoc after filter, parser, deduplicator middleware.**

## Headers

+ **sudoc-enrich** : Set to ``false`` to disable sudoc enrichment. Enabled by default.
+ **sudoc-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **sudoc-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **sudoc-max-attempts** : Maximum number of trials before passing the EC in error. Defaults to ``5``.

## How to use

### ezPAARSE admin interface

You can add or remove sudoc by default to all your enrichments, To do this, go to the middleware section of administration.

![image](./docs/admin-interface.png)

### ezPAARSE process interface

You can use sudoc for an enrichment process. You just add the middleware.

![image](./docs/process-interface.png)

### ezp

You can use sudoc for an enrichment process with [ezp](https://github.com/ezpaarse-project/node-ezpaarse) like this:

```bash
# enrich with one file
ezp process <path of your file> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: sudoc"
  --out ./result.csv

# enrich with multiples files
ezp bulk <path of your directory> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: sudoc" 

```

### curl

You can use sudoc for an enrichment process with curl like this:

```bash
curl -X POST -v http://localhost:59599 \
  -H "ezPAARSE-Middlewares: sudoc" \
  -H "Log-Format-Ezproxy: <line format>" \
  -F "file=@<log file path>"

```