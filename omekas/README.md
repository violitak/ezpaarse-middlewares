# omekas

Fetches metadata from platforms working with [OmekaS](https://omeka.org/s/). This middleware was designed for internal use at Inist-CNRS

## Enriched fields

| Name | Type | Description |
| --- | --- | --- |
| publication_title | String | Name of publication. |
| ark | String | ID ARK of this resource. |

## Prerequisites

This middleware can only be used to enrich one omeka-S platform per process. 
One of the keys corresponding to the platform name must be selected from this [file](https://github.com/ezpaarse-project/ezpaarse-middlewares/blob/master/omekas/manifest.json).
Your EC needs a omekaS ID for enrichment. 
Some platforms may have private resources, to obtain enrichments on these platforms, It is necessary to enter a pair of API keys for each platform in the ezPAARSE processing configuration.

**You must use omekas after filter, parser, deduplicator middleware.**

## Headers

+ **omekas-platform** : name of platform selected from this [file](https://github.com/ezpaarse-project/ezpaarse-middlewares/blob/master/omekas/manifest.json).
+ **omekas-cache** : Enable/Disable cache.
+ **omekas-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **omekas-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **omekas-key-credential** : Part of the key pair to access private resource metada.
+ **omekas-key-identity** : Part of the key pair to access private resource metada.

## How to use

### ezPAARSE admin interface

You can add omekas by default to all your enrichments, To do this, go to the middleware section of administration.

![image](./docs/admin-interface.png)

### ezPAARSE process interface

You can use omekas for an enrichment process. You just add the middleware.
![image](./docs/process-interface.png)

### ezp

You can use omekas for an enrichment process with [ezp](https://github.com/ezpaarse-project/node-ezpaarse) like this:

```bash
# enrich with one file
ezp process <path of your file> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "ezPAARSE-Middlewares: omekas" \
  --header "omekas-platform: <platform name>" \
  --header "omekas-key-identity: <identity key>" \
  --header "omekas-key-credentials: <credentials key>"
  --out ./result.csv

# enrich with multiples files
ezp bulk <path of your directory> \
  --host <host of your ezPAARSE instance> \
  --settings <settings-id> \
  --header "omekas-platform: <platform name>" \
  --header "omekas-key-identity: <identity key>" \
  --header "omekas-key-credentials: <credentials key>"

```

### curl

You can use omekas for an enrichment process with curl like this:

```bash
curl -X POST -v http://localhost:59599 \
  -H "ezPAARSE-Middlewares: omekas" \
  -H "omekas-platform: <platform name>" \
  -H "omekas-key-identity: <identity key>" \
  -H "omekas-key-credentials: <credentials key>" \
  -H "Log-Format-Ezproxy: <line format>" \
  -F "file=@<log file path>"

```