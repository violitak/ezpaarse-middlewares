# labelize

This middleware allows you to add a field to based on the content of another field. To use it, you have to set the ezPAARSE config.
## Example

```json
{
  "EZPAARSE_LABELIZE": [
    {
      "from": "domain",
      "result-field": "organization",
      "mapping": {
        "psl.fr": "PSL",
        "paristech.com": "ParisTech",
        "dauphine.org": "Dauphine",
        "paris-dauphine.org": "Dauphine",
      }
    },
    {
      "from": "code",
      "result-field": "status",
      "mapping": {
        "200": true,
        "202": true,
        "400": false,
        "404": false,
      }
    },
  ]
  
}
```

