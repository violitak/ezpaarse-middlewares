# parser

Parses the URL associated with a consultation event (by calling the appropriate parser)

## Headers

+ **filter-platforms** : comma-separated list of platforms to handle. Lines with a matching parser that is not specified are considered irrelevant and filtered out.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: parser"
  -F "files[]=@access.log"
```