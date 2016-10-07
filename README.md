# ezpaarse-middlewares
Middlewares for ezPAARSE

## Specifications
Each middleware must have its own directory, with `index.js` as entrypoint, and must export a function that will serve as `initiator`. The initiator function must return either the actual processing function, or a `promise` that will then return it. In case of failure during the initialization, returning an `Error` object (or rejecting the `promise`) will abort the job.

The `processing function` takes the EC as first argument and a function to call when the EC should go on to the next middleware. Calling this function with an error will result in the EC being rejected. When there's no line left to read, the function will be called with `null` as EC.

The `initiator` and the `processing function` have the following properties in their context (this) :
- `request`: the request stream.
- `response`: the response stream.
- `job`: the job object.
- `logger`: a winston instance (shorthand for job.logger).
- `report`: a report object (shorthand for job.report).
- `saturate`: a function to call when the middleware is saturated.
- `drain`: a function to call when the middleware is not saturated anymore.

## Example

### Article counter

Here is an example of a very simple middleware that counts the articles and put the total in the report as `General -> nb-articles` :

```javascript
module.exports = function articleCounter() {
  this.logger.verbose('Initializing article counter');

  this.report.set('general', 'nb-articles', 0);

  // Processing function
  return function count(ec, next) {
    if (!ec) { return next(); }
    
    if (ec.rtype === 'ARTICLE') {
      this.report.inc('general', 'nb-articles');
    }
    
    next();
  };
};
```

### Mandatory field

This middleware is a bit more advanced. It's activated by giving a field name in the `Mandatory-Field` header and it filters any EC that doesn't have a value for this field. An error is thrown on startup if the header contains a space.

```javascript
module.exports = function mandatoryField() {
  this.logger.verbose('Initializing mandatory field');
  
  let mandatoryField = req.header('Mandatory-Field');

  if (mandatoryField && mandatoryField.includes(' ')) {
    let err = new Error('space not allowed in mandatory field');
    err.status = 400;
    return err;
  }

  /**
   * Actual processing function
   * @param  {Object}   ec   the EC to process, null if no EC left
   * @param  {Function} next the function to call when we are done with the given EC
   */
  return function process(ec, next) {
    if (!mandatoryField || !ec) { return next(); }

    if (ec[mandatoryField]) {
      next();
    } else {
      next(new Error(mandatoryField + ' is missing'));
    }
  };
};
```
