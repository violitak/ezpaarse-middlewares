# omekas

Experimental middleware that fetches metadata from the api omekas
## Headers

+ **omekas-baseUrl** : baseUrl of plateform.
+ **omekas-cache** : Enable/Disable cache.
+ **omekas-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **omekas-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
