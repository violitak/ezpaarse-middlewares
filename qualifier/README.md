# qualifier

Checks consultation events' qualification. See the [dedicated page](../features/qualification.html) for more detail.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: qualifier"
  -F "files[]=@access.log"
```