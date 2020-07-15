# filter

Filters irrelevant consultation events

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: filter"
  -F "files[]=@access.log"
```
