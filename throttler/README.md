# throttler

Regulates the consultation events' stream

## Headers

+ **Throttling** : Minimum time to wait between queries, in milliseconds. Defaults to ``0``ms.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: throttler"
  -F "files[]=@access.log"
```