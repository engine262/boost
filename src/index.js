'use strict';

const { JSEvaluator } = require('./js');

module.exports = (engine262) => {
  const js = new JSEvaluator(engine262);

  return {
    callFunction(thisArgument, argumentsList) {
      return js.callFunction(this, thisArgument, argumentsList);
    },
    constructFunction(argumentsList, newTarget) {
      return js.constructFunction(argumentsList, newTarget);
    },
    evaluateScript(scriptRecord) {
      return js.evaluateScript(scriptRecord);
    },
  };
};
