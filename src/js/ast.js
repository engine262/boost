'use strict';

// TODO: Investigate if there is a fast way to do this without mutating
// the original AST.
class ASTConstantFolder {
  replace(node, type, props) {
    return {
      type,
      location: node.location,
      ...props,
    };
  }

  fold(node) {
    // TODO: unroll this?
    return this[`fold${node.type}`](node);
  }

  foldScript(Script) {
    return this.fold(Script.ScriptBody);
  }

  foldScriptBody(ScriptBody) {
    ScriptBody.StatementList = ScriptBody.StatementList.map((S) => this.fold(S));
    return ScriptBody;
  }

  foldBlock(Block) {
    Block.StatementList = Block.StatementList.map((S) => this.fold(S));
    if (Block.StatementList.length === 0) {
      return this.replace(Block, 'NullLiteral', {});
    }
    if (Block.StatementList.length === 1) {
      return Block.StatementList[0];
    }
    return Block;
  }

  foldIfStatement(IfStatement) {
    IfStatement.Expression = this.fold(IfStatement.Expression);

    // TODO: support all literal types
    if (IfStatement.Expression.type === 'BooleanLiteral') {
      if (IfStatement.Expression.value) {
        return this.fold(IfStatement.Statement_a);
      }
      return IfStatement.Statement_b
        ? this.fold(IfStatement.Statement_b)
        : this.replace(IfStatement, 'NullLiteral', {});
    }

    IfStatement.Statement_a = this.fold(IfStatement.Statement_a);
    IfStatement.Statement_b = this.fold(IfStatement.Statement_b);

    return IfStatement;
  }

  foldExpressionStatement(ExpressionStatement) {
    return this.fold(ExpressionStatement.Expression);
  }

  foldAdditiveExpression(E) {
    E.AdditiveExpression = this.fold(E.AdditiveExpression);
    E.MultiplicativeExpression = this.fold(E.MultiplicativeExpression);

    // TODO: support all literal types
    if (E.AdditiveExpression.type === 'NumericLiteral'
        && E.MultiplicativeExpression.type === 'NumericLiteral') {
      return this.replace(E, 'NumericLiteral', {
        value: E.operator === '+'
          ? E.AdditiveExpression.value + E.MultiplicativeExpression.value
          : E.AdditiveExpression.value - E.MultiplicativeExpression.value,
      });
    }

    return E;
  }

  foldBooleanLiteral(BooleanLiteral) {
    return BooleanLiteral;
  }

  foldNumericLiteral(NumericLiteral) {
    return NumericLiteral;
  }

  foldStringLiteral(StringLiteral) {
    return StringLiteral;
  }
}

function fold(ast) {
  const cf = new ASTConstantFolder();
  return cf.fold(ast);
}

module.exports = { fold };
