# cut

Separates any unique field into two or more distinct fields, based on a given separator or regular expression

## Headers

+ **extract** : This header takes 3 parameters which are ``sourceField``, ``expression`` and ``destinationFields``, e.g: ``sourceField=>expression=>destinationFields``

### Examples

+ Use with regex :

> In this example we want to retrieve separately the last name and the first name of a user so the login is lastName.firstName.
```

curl -v -X POST http://localhost:59599
-H "ezPAARSE-Middlewares: cut"
-H "extract: login => /^([a-z]+)\.([a-z]+)$/ => lastName,firstName" \
-F "files[]=@access.log"
```

+ Use with split function :

> In this example we want to retrieve different username and domain name compared to an email address

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: cut"
  -H "extract: email => split(@) => identifiant,domainName" \
  -F "files[]=@access.log"
```
