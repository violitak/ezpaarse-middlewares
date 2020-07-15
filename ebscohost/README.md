# ebscohost

Retrieves Ebscohost database titles in the official short names list

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: ebscohost"
  -F "files[]=@access.log"
```