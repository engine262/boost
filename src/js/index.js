'use strict';

const ast = require('./ast');

class Code {
  ensureCode(R) {
    if (!R.code) {
      const folded = ast.fold(R.ECMAScriptCode);
      // TODO: bytecode
      // R.code = createBytecode(folded);
    }
    return R.code;
  }
}

class JSEvaluator {
  constructor(engine262) {
    this.engine262 = engine262;
    this.code = new Code();
  }

  evaluateScript(scriptRecord) {
    this.code.ensureCode(scriptRecord);
    // TODO: script entry
    return this.engine262.Value.undefined;
  }

  callFunction(F, _thisArgument, _argumentList) {
    this.code.ensureCode(F);
    // TODO: function call entry
    return this.engine262.Value.undefined;
  }

  constructFunction(F, _argumentList, _newTarget) {
    this.code.ensureCode(F);
    // TODO: function construct entry
    return this.engine262.Value.undefined;
  }
}

module.exports = { JSEvaluator };
