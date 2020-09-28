'use strict';

const { BytecodeGenerator } = require('./bytecode');
const { Interpreter } = require('./interpreter');

class RegExpEvaluator {
  constructor(engine262) {
    this.engine262 = engine262;
  }

  evaluatePattern(ast, flags) {
    const code = BytecodeGenerator.generate(this.engine262, ast, flags);
    return (S, index) => {
      let input;
      if (flags.includes('u')) {
        input = [...S.stringValue()].map((c) => c.codePointAt(0));
      } else {
        input = S.stringValue().split('').map((c) => c.charCodeAt(0));
      }

      const e = new Interpreter(code, input, index.numberValue());

      const numMatches = e.findMatches(ast.capturingGroups.length + 1);

      if (numMatches === 0) {
        return 'failure';
      }

      const groups = Array.from({ length: ast.capturingGroups.length + 1 }, (_, i) => {
        if (i === 0) {
          return this.engine262.Value.undefined;
        }
        const startIndex = e.bestMatches[i * 2];
        const endIndex = e.bestMatches[(i * 2) + 1];
        if (startIndex >= 0 && endIndex >= 0) {
          return input.slice(startIndex, endIndex);
        }
        return this.engine262.Value.undefined;
      });

      return new this.engine262.RegExpState(e.bestMatches[1], groups);
    };
  }
}

module.exports = { RegExpEvaluator };
