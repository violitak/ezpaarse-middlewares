# labelize

This middleware allows you to add a field to based on the content of another field. To use it, you have to set the ezPAARSE config.
## Example

```json
{
  "EZPAARSE_LABELIZE": [
    {
       "if": { "field": "email", "value": "cnrs" },
       "set": { "field": "organization", "value": "cnrs" }
    },
    {
       "if": { "field": "email", "value": "cnrs" },
       "set": { "field": "organization", "value": "cnrs" }
    }
  ]
}
```