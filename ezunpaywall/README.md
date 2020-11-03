# unpaywall

Experimental middleware that fetches metadata from the Unpaywall mirror hosted by the Inist-CNRS.

## Headers

+ **ezunpaywall-cache** : Enable/Disable cache.
+ **ezunpaywall-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **ezunpaywall-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **ezunpaywall-paquet-size** : Maximum number of identifiers to send for query in a single request. Defaults to ``50``.
+ **ezunpaywall-buffer-size** : Maximum number of memorised access events before sending a request. Defaults to ``1000``.

### Example :

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: ezunpaywall"
  -F "files[]=@access.log"
```
