# trackcode-generator

Generate a random trackcode based on host field, and remove the host field. The trackcode is cached for one year.

## Prerequisites

**You must use trackcode-generator after filter, parser, deduplicator middleware.**

## How to use

### ezPAARSE admin interface

You can add or remove trackcode-generator by default to all your enrichments. To do this, go to the middleware section of administration.

![image](./docs/admin-interface.png)

### ezPAARSE process interface

You can use trackcode-generator for an enrichment process.

![image](./docs/process-interface.png)

### ezp

You can use trackcode-generator for an enrichment process with [ezp](https://github.com/ezpaarse-project/node-ezpaarse) like this:

```bash
# enrich with one file
ezp process <path of your file> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: trackcode-generator" \
  --out ./result.csv

# enrich with multiples files
ezp bulk <path of your directory> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: trackcode-generator" 

```

### curl

You can use trackcode-generator for an enrichment process with curl like this:

```bash
curl -X POST -v http://localhost:59599 \
  -H "ezPAARSE-Middlewares: trackcode-generator" \
  -H "Log-Format-Ezproxy: <line format>" \
  -F "file=@<log file path>"

```


