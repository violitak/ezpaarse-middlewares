# host-chain

Split a chain of multiple IPs and only keep the first one. The original value is stored in another field.

## Headers

+ **host-chain-real-position** : position of the real IP. Defaults to the `first` one. Set it to `last` to keep the last IP of the chain.
+ **host-chain-field** : the field that contains the host. Defaults to `host`.
+ **host-chain-full-field** : the field that will contain the original value. Defaults to `full_host`.
+ **host-chain-separator** : the separator used to separate hosts. Defaults to `,`.

### Example

```bash
curl -v -X POST http://localhost:59599
  -H "ezPAARSE-Middlewares: host-chain"
  -F "files[]=@access.log"
```