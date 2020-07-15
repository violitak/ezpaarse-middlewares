# user-agent-parser

Parse the user-agent string and add a `ua` field containing the navigator name.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: user-agent-parser"
  -F "files[]=@access.log"
```