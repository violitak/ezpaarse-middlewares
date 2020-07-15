# trackcode-generator

Generate a random trackcode based on host field, and remove the host field. The trackcode is cached for one year.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: trackcode-generator"
  -F "files[]=@access.log"
```