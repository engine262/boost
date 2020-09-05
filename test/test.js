'use strict';

const engine262 = require('../../engine262');
const boost = require('..');

const {
  Agent,
  setSurroundingAgent,
  ManagedRealm,
} = engine262;

const agent = new Agent({
  boost: boost(engine262),
});
setSurroundingAgent(agent);

const realm = new ManagedRealm();

console.log(realm.evaluateScript(`
3 - 1;

if (false) {
  'hello';
} else {
  'goodbye';
}
`));
