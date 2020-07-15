# eprints

Get metadata from OAI-PMH.

## Parameters

+ **eprints-cache** : Enabled/Disabled cache
+ **eprints-ttl** : Time-to-live of cached documents
+ **eprints-throttle** : Minimum wait time before each request (in ms)
+ **eprints-packet-size** : Maximum number of article to query
+ **eprints-buffer-size** : Minimum number of ECs to keep before resolving them
+ **eprints-domain-name** : Domain name eprints platform 

## Configuration 

+ Default parser : **eprints**
+ ezPAARSE-Middlewares : **eprints**

```
curl -v -X POST http://localhost:59599 \
 -H "Force-Parser: eprints" \
 -H "ezPAARSE-Middlewares: eprints" \
 -H "eprints-domain-name: https://domain.fr/" \
 -F "files[]=@access.log"
```
