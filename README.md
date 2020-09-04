# boost

boost is a collection of optimizing interpreters for engine262. Contrary to the
goals of engine262, boost provides fast execution time at the cost of
understandability and modifiability.

boost targets:

- JS function [[Call]] and [[Construct]] behavior.
- JS top-level Script and Module evaluation.
- RegExp execution

### Usage

```js
const engine262 = require('@engine262/engine262');
const boost = require('@engine262/boost');

const agent = new engine262.Agent({
  boost: boost(engine262),
});

// ...
```
