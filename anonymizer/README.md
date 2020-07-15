# anonymizer

Anonymizes a list of fields.

## Headers

+ **Crypted-Fields** : name of the fields to be encrypted *(default: host,login)*
+ **Crypting-Algorithm** : Encryption algorithm *(default: sha1)*
+ **Crypting-Salt** : Encryption salt

## Configuration

+ ezPAARSE-Middlewares : **anonymizer**

```
curl -v -X POST http://localhost:59599
-H "ezPAARSE-Middlewares: anonymizer"
-F "files[]=@access.log"
```