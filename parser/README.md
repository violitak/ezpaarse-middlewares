# parser

Parses the URL associated with a consultation event (by calling the appropriate parser)

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: parser"
  -F "files[]=@access.log"
```