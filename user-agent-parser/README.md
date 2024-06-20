# user-agent-parser

Parse the user-agent string and add a `ua` field containing the navigator name.

## Enriched fields

| Name | Type | Description |
| --- | --- | --- |
| ua | String | Simplified name of user agent. |

### Example

## How to use

### ezPAARSE admin interface

You can add user-agent-parser by default to all your enrichments, To do this, go to the middleware section of administration.

![image](./docs/admin-interface.png)

### ezPAARSE process interface

You can use user-agent-parser for an enrichment process. You just add the middleware.

![image](./docs/process-interface.png)

### ezp

You can use user-agent-parser for an enrichment process with [ezp](https://github.com/ezpaarse-project/node-ezpaarse) like this:

```bash
# enrich with one file
ezp process <path of your file> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: user-agent-parser" \
  --out ./result.csv

# enrich with multiples files
ezp bulk <path of your directory> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: user-agent-parser" 

```

### curl

You can use user-agent-parser for an enrichment process with curl like this:

```bash
curl -X POST -v http://localhost:59599 \
  -H "ezPAARSE-Middlewares: user-agent-parser" \
  -H "Log-Format-Ezproxy: <line format>" \
  -F "file=@<log file path>"

```