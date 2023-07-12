# ncbi-enrichment

The NCBI Enrichment middleware uses the ``unit_id`` found in NCBI access events to request Pubmed metadata using the [NCBI API](https://www.ncbi.nlm.nih.gov/books/NBK25501/).

## Headers

+ **ncbi-cache** : Set to ``false`` to disable result caching. Enabled by default.
+ **ncbi-ttl** : Lifetime of cached documents, in seconds. Defaults to ``7 days (3600 * 24 * 7)``
+ **ncbi-throttle** : Minimum time to wait between each query, in milliseconds. Defaults to ``500``ms. Make no more than 3 requests per second unless you are registered with the NCBI API.
+ **ncbi-packet-size** : Maximum number of memorized NCBI access events before sending requests. Defaults to ``200``.
+ **ncbi-buffer-size** : Maximum number of memorized access events before sending requests. Defaults to ``1000``.
+ **ncbi-max-tries** : Maximum number of attempts if an enrichment fails. Defaults to ``5``.
+ **ncbi-email** : The email for reference for API calls. Defaults to ``YOUR_EMAIL``.  The email and tool can be registered with NCBI to increase the number of requests per second for the application.
+ **ncbi-tool** : The tool for reference for API calls. Defaults to ``ezPAARSE``.  The email and tool can be registered with NCBI to increase the number of requests per second for the application.

## Enriched fields

| Name | Type | Description |
| --- | --- | --- |
| issn | String | International Standard Serial Number for publications. |
| essn | String | Electronic ISSN for publications. |
| publication_title | String | The full name of the journal. |
| doi | String | The digital object identifier. |
| title | String | The article title. |

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: ncbi-enrichment"
  -F "files[]=@access.log"
```
