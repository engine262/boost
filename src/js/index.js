'use strict';

const ast = require('./ast');

const Op = {};
[
  'LOAD_DOUBLE',
  'LOAD_STRING',

  'RETURN',
].forEach((n, i) => {
  Op[n] = i;
});

class BytecodeGenerator {
  constructor() {
    this.code = [];
  }

  ensureCode(R) {
    if (R.code === undefined) {
      R.code = this.code.length;
      this.visit(ast.fold(R.ECMAScriptCode));
      this.return();
    }
    return R.code;
  }

  write(v) {
    this.code.push(v);
  }

  loadDouble(d) {
    this.write(Op.LOAD_DOUBLE);
    this.write(d);
  }

  loadString(s) {
    this.write(Op.LOAD_STRING);
    this.write(s);
  }

  return() {
    this.write(Op.RETURN);
  }

  // VISITORS

  visit(node) {
    return this[`visit${node.type}`](node);
  }

  visitScript(node) {
    this.visit(node.ScriptBody);
  }

  visitScriptBody(node) {
    node.StatementList.forEach((S) => {
      this.visit(S);
    });
  }

  visitBlock(node) {
    node.StatementList.forEach((S) => {
      this.visit(S);
    });
  }

  visitNumericLiteral(node) {
    this.loadDouble(node.value);
  }

  visitStringLiteral(node) {
    this.loadString(node.value);
  }
}

class JSEvaluator {
  constructor(engine262) {
    this.engine262 = engine262;
    this.bytecode = new BytecodeGenerator();

    this.pc = -1;
    this.acc = this.engine262.Value.undefined;

    this.handlers = [
      this.opLoadDouble,
      this.opLoadString,
      this.opReturn,
    ];
  }

  evaluateScript(scriptRecord) {
    const pc = this.bytecode.ensureCode(scriptRecord);
    // TODO: script entry
    this.pc = pc;
    return this.evaluate();
  }

  callFunction(F, _thisArgument, _argumentList) {
    this.code.ensureCode(F);
    // TODO: function call entry
    return this.evaluate();
  }

  constructFunction(F, _argumentList, _newTarget) {
    this.code.ensureCode(F);
    // TODO: function construct entry
    return this.evaluate();
  }

  evaluate() {
    while (true) {
      const op = this.bytecode.code[this.pc];
      this.pc += 1;
      const r = this.handlers[op].call(this);
      if (r !== undefined) {
        return r;
      }
    }
  }

  opLoadDouble() {
    const { Value } = this.engine262;

    const value = this.bytecode.code[this.pc];
    this.pc += 1;

    this.acc = new Value(value);
  }

  opLoadString() {
    const { Value } = this.engine262;

    const value = this.bytecode.code[this.pc];
    this.pc += 1;

    this.acc = new Value(value);
  }

  opReturn() {
    const { Completion } = this.engine262;

    return new Completion({ type: 'Return', Value: this.acc, Target: undefined });
  }
}

module.exports = { JSEvaluator };
