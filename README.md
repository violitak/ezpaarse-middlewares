# ezpaarse-middlewares
Middlewares for ezPAARSE

## Specifications
Each middleware must have its own directory, with `index.js` as entrypoint, and must export a function that will serve as `initiator`. The initiator function must return either the actual processing function, or a `promise` that will then return it.

The `processing function` takes the EC as first argument and a function to call when the EC should go on to the next middleware. When there's no line left to read, the function will be called with `null` as EC.

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
