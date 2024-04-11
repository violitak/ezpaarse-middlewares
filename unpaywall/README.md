# unpaywall

The Unpaywall middleware uses the ``DOI`` found in access events to request Open Acess metadata using the Unpaywall API. Limited to ``100 000`` DOIs per day.

## Headers

+ **unpaywall-cache** : Set to ``false`` to disable result caching. Enabled by default.
+ **unpaywall-TTL** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``
+ **unpaywall-throttle** : Minimum time to wait between each query, in milliseconds. Defaults to ``100``ms. Throttle time ``doubles`` after each failed attempt.
+ **unpaywall-paquet-size** : Maximum number of DOIs to request in parallel. Defaults to ``10``
+ **unpaywall-buffer-size** : Maximum number of memorised access events before sending requests. Defaults to ``200``
+ **unpaywall-max-tries** : Maximum number of attempts if an enrichment fails. Defaults to ``5``.
+ **unpaywall-on-fail** : Strategy to adopt if an enrichment reaches the maximum number of attempts. Can be either of ``abort``, ``ignore`` or ``retry``. Defaults to ``abort``.
+ **unpaywall-email** : The email to use for API calls. Defaults to ``YOUR_EMAIL``.

## Enriched fields

| Name | Type | Description |
| --- | --- | --- |
| is_oa | Boolean | Is there an OA copy of this resource. |
| journal_is_in_doaj | Boolean | Is this resource published in a DOAJ-indexed journal. |
| journal_is_oa | Boolean | Is this resource published in a completely OA journal. |
| oa_status | String | The OA status, or color, of this resource. |
| updated | String | Time when the data for this resource was last updated. |

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: unpaywall"
  -F "files[]=@access.log"
```