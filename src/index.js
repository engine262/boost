'use strict';

// const { JSEvaluator } = require('./js');
const { RegExpEvaluator } = require('./regexp');

module.exports = (engine262) => {
  // const js = new JSEvaluator(engine262);
  const regexp = new RegExpEvaluator(engine262);

  return {
    /*
    callFunction(thisArgument, argumentsList) {
      return js.callFunction(this, thisArgument, argumentsList);
    },
    constructFunction(argumentsList, newTarget) {
      return js.constructFunction(argumentsList, newTarget);
    },
    evaluateScript(scriptRecord) {
      return js.evaluateScript(scriptRecord);
    },
    */
    evaluatePattern(ast, flags) {
      // Some RegExp cannot be represented by the boost interpreter,
      // so fall back to engine262's built-in pattern evaluator.
      try {
        return regexp.evaluatePattern(ast, flags);
      } catch {
        return engine262.Evaluate_Pattern(ast, flags);
      }
    },
  };
};
