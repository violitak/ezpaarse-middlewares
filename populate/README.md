# populate

Allows for populating fields with arbitrary data. To use it, set the header `Populate-Fields` with a JSON representation of the fields that should be populated. Any JSON compliant value will be affected to the EC with the corresponding key.

## Headers

+ **populate-fields** : 

## Example
Insert `website` into the field `portal`.

```
Populate-Fields: { "portal": "website" }
```
