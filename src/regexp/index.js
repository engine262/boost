'use strict';

const { BytecodeGenerator } = require('./bytecode');
const { Interpreter } = require('./interpreter');

class RegExpEvaluator {
  constructor(engine262) {
    this.engine262 = engine262;
  }

  evaluatePattern(ast, flags) {
    const b = new BytecodeGenerator(this.engine262, flags);
    b.visit(ast);
    return (S, index) => {
      let input;
      if (flags.includes('u')) {
        input = [...S.stringValue()].map((c) => c.codePointAt(0));
      } else {
        input = S.stringValue().split('').map((c) => c.charCodeAt(0));
      }

      const e = new Interpreter(b.code, input, index.numberValue());

      const numMatches = e.findMatches(ast.capturingGroups.length + 1);

      if (numMatches === 0) {
        return 'failure';
      }

      const registers = e.bestMatchRegisters;

      const groups = Array.from({ length: ast.capturingGroups.length + 1 }, (_, i) => {
        if (i === 0) {
          return this.engine262.Value.undefined;
        }
        const startIndex = registers[i * 2];
        const endIndex = registers[(i * 2) + 1];
        if (startIndex === -1 || endIndex === -1) {
          return this.engine262.Value.undefined;
        }
        return input.slice(startIndex, endIndex);
      });

      return new this.engine262.RegExpState(registers[1], groups);
    };
  }
}

module.exports = { RegExpEvaluator };
