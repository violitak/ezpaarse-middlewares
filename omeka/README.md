# omeka

Experimental middleware that fetches metadata from the api omeka
## Headers

+ **omeka-baseUrl** : baseUrl of plateform.
+ **omeka-cache** : Enable/Disable cache.
+ **omeka-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``.
+ **omeka-throttle** : Minimum time to wait between queries, in milliseconds. Defaults to ``200``ms.
+ **omeka-base-wait-time** : Time to wait before retrying after a query fails, in milliseconds. Defaults to ``1000``ms. This time ``doubles`` after each attempt.
+ **omeka-max-tries** : Maximum number of attempts if an enrichment fails. Defaults to ``5``.
