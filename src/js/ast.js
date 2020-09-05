'use strict';

const NODES = {
  IdentifierReference: [],
  BindingIdentifier: [],
  LabelIdentifier: [],
  Identifier: [],
  NullLiteral: [],
  BooleanLiteral: [],
  NumericLiteral: [],
  StringLiteral: [],
  ArrayLiteral: ['ElementList'],
  ObjectLiteral: ['PropertyDefinitionList'],
  FunctionExpression: ['FormalParameters', 'FunctionBody'],
  ClassExpression: ['ClassTail'],
  ClassTail: ['ClassHeritage', 'ClassBody'],
  ClassBody: ['ClassElementList'],
  ClassElement: ['MethodDefinition'],
  GeneratorExpression: ['FormalParameters', 'GeneratorBody'],
  AsyncFunctionExpression: ['FormalParameters', 'AsyncFunctionBody'],
  AsyncGeneratorExpression: ['FormalParameters', 'AsyncGeneratorBody'],
  RegularExpressionLiteral: [],
  TemplateLiteral: ['ExpressionList'],
  MemberExpression: ['MemberExpression', 'Expression'],
  SuperProperty: [],
  MetaProperty: [],
  NewExpression: ['MemberExpression', 'Arguments'],
  CallExpression: ['CallExpression', 'Arguments'],
  SuperCall: ['Arguments'],

  // ExponentiationExpression
  // AdditiveExpression
  // MultiplicativeExpression
  // AdditiveExpression
  // ShiftExpression
  // RelationalExpression
  // EqualityExpression
  // BitwiseANDExpression
  // BitwiseXORExpression
  // BitwiseORExpression
  // LogicalANDExpression
  // LogicalORExpression
  // CoalesceExpression
  // ConditionalExpression
  // AssignmentExpression

  BlockStatement: ['Block'],
  Block: ['StatementList'],
  VariableStatement: [],
  EmptyStatement: [],
  // ExpressionStatement
  // IfStatement

  Script: ['ScriptBody'],
  ScriptBody: ['StatementList'],
};

function fold(node) {
  const clone = { ...node };
  switch (node.type) {
    case 'AdditiveExpression': {
      const left = fold(node.AdditiveExpression);
      const right = fold(node.MultiplicativeExpression);
      // TODO: support all literal types
      if (left.type === 'NumericLiteral' && right.type === 'NumericLiteral') {
        clone.type = 'NumericLiteral';
        clone.value = node.operator === '+'
          ? left.value + right.value
          : left.value - right.value;
        return clone;
      }
      clone.AdditiveExpression = left;
      clone.MultiplicativeExpression = right;
      return clone;
    }
    case 'ExpressionStatement':
      return fold(node.Expression);
    case 'IfStatement':
      clone.Expression = fold(node.Expression);
      // TODO: support all literal types
      if (clone.Expression.type === 'BooleanLiteral') {
        if (clone.Expression.value) {
          return fold(node.Statement_a);
        }
        if (node.Statement_b) {
          return fold(node.Statement_b);
        }
        clone.type = 'NullLiteral';
        return clone;
      }
      clone.Statement_a = fold(node.Statement_a);
      clone.Statement_b = fold(node.Statement_b);
      return clone;
    default: {
      if (!NODES[node.type]) {
        throw new RangeError(node.type);
      }
      NODES[node.type].forEach((field) => {
        if (Array.isArray(node[field])) {
          clone[field] = node[field].map((f) => fold(f));
        } else {
          clone[field] = fold(node[field]);
        }
      });
      return clone;
    }
  }
}

module.exports = { fold };
