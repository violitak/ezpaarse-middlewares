# omeka

Experimental middleware that fetches metadata from the api omeka
## Headers

+ **omeka-baseUrl** : baseUrl of plateform.
+ **omeka-cache** : Enable/Disable cache.
+ **omeka-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **omeka-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
