# labelize

This middleware allows you to add a field to based on the content of another field. To use it, you have to set the ezPAARSE config.
## Example

```json
{
  "EZPAARSE_LABELIZE": [
    {
       "if": { "field": "email", "value": "@(inist|cnrs)\\.fr$" },
       "set": { "field": "organization", "value": "CNRS" }
    },
    {
       "if": { "field": "publication_date", "value": "18[0-9]{2}" },
       "set": { "field": "old", "value": "true" }
    }
  ]
}
```