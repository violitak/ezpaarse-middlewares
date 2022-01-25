# labelize


## Example

```json
{
  "EZPAARSE_LABELIZE": [
    {
       "if": { "field": "email", "value": "/(cnrs)$/i" },
       "set": { "field": "organization", "value": "cnrs" }
    }
  ]
}
```