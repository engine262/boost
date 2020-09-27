'use strict';

const { Op } = require('./interpreter');

// must be canonical
function complement(ranges) {
  const out = [];
  let from = 0;
  ranges.forEach(([c1, c2], i) => {
    if (i === 0 && c1 === 0) {
      from = c2 + 1;
    } else {
      out.push([from, c1 - 1]);
      from = c2 + 1;
    }
  });
  if (from < 0x10FFFF) {
    out.push([from, 0x10FFFF]);
  }
  return out;
}

function moveRanges(ranges, from, to, count) {
  if (from < to) {
    for (let i = count - 1; i >= 0; i -= 1) {
      ranges[to + i] = ranges[from + i];
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      ranges[to + i] = ranges[from + i];
    }
  }
}

function insertRangeInCanonicalList(ranges, count, insert) {
  const [from, to] = insert;
  let startPos = 0;
  let endPos = count;
  for (let i = count - 1; i >= 0; i -= 1) {
    const current = ranges[i];
    if (current[0] > to + 1) {
      endPos = i;
    } else if (current[1] + 1 < from) {
      startPos = i + 1;
      break;
    }
  }

  if (startPos === endPos) {
    if (startPos < count) {
      moveRanges(ranges, startPos, startPos + 1, count - startPos);
    }
    ranges[startPos] = insert;
    return count + 1;
  }
  if (startPos + 1 === endPos) {
    const toReplace = ranges[startPos];
    const newFrom = Math.min(toReplace[0], from);
    const newTo = Math.max(toReplace[1], to);
    ranges[startPos] = [newFrom, newTo];
    return count;
  }

  const newFrom = Math.min(ranges[startPos][0], from);
  const newTo = Math.max(ranges[endPos - 1][1], to);
  if (endPos < count) {
    moveRanges(ranges, endPos, startPos + 1, count - endPos);
  }
  ranges[startPos] = [newFrom, newTo];
  return count - (endPos - startPos) + 1;
}

function canonicalize(ranges) {
  let max = ranges[0][1];
  let i = 1;
  while (i < ranges.length) {
    const current = ranges[i];
    if (current[0] <= max + 1) {
      break;
    }
    max = current[1];
    i += 1;
  }
  if (i === ranges.length) {
    return;
  }
  let numCanonical = i;
  do {
    numCanonical = insertRangeInCanonicalList(ranges, numCanonical, ranges[i]);
    i += 1;
  } while (i < ranges.length);
}

class BytecodeGenerator {
  constructor(engine262, flags) {
    this.engine262 = engine262;
    this.flags = flags;
    this.code = [];
  }

  visit(node) {
    switch (node.type) {
      case 'Pattern':
        return this.visitPattern(node);
      case 'Disjunction':
        return this.visitDisjunction(node);
      case 'Alternative':
        return this.visitAlternative(node);
      case 'Term':
        return this.visitTerm(node);
      case 'Assertion':
        return this.visitAssertion(node);
      case 'Atom':
        return this.visitAtom(node);
      case 'AtomEscape':
        return this.visitAtomEscape(node);
      case 'CharacterClass':
        return this.visitCharacterClass(node);
      default:
        throw new RangeError(node.type);
    }
  }

  label() {
    return {
      pc: -1,
      patches: [],
    };
  }

  jumpImpl(op, l) {
    if (l.pc === -1) {
      l.patches.push(this.code.length);
      this.code.push({
        op,
        pc: -1,
      });
    } else {
      this.code.push({
        op,
        pc: l.pc,
      });
    }
  }

  jump(l) {
    this.jumpImpl(Op.JUMP, l);
  }

  bind(l) {
    l.pc = this.code.length;
    l.patches.forEach((i) => {
      this.code[i].pc = l.pc;
    });
  }

  fork(l) {
    this.jumpImpl(Op.FORK, l);
  }

  consumeRange(min, max) {
    this.code.push({
      op: Op.CONSUME_RANGE,
      min,
      max,
    });
  }

  consumeRanges(ranges) {
    const emit = (range) => {
      this.consumeRange(range[0], range[1]);
    };

    if (ranges.length === 1) {
      emit(ranges[0]);
      return;
    }

    const end = this.label();
    for (let i = 0; i < ranges.length; i += 1) {
      const range = ranges[i];
      if (i === ranges.length - 1) {
        emit(range);
      } else {
        const tail = this.label();
        this.fork(tail);
        emit(range);
        this.jump(end);
        this.bind(tail);
      }
    }
    this.bind(end);
  }

  assertion(type) {
    this.code.push({
      op: Op.ASSERTION,
      type,
    });
  }

  markMatchStart(index) {
    this.code.push({
      op: Op.MARK_MATCH_START,
      index,
    });
  }

  markMatchEnd(index) {
    this.code.push({
      op: Op.MARK_MATCH_END,
      index,
    });
  }

  accept() {
    this.code.push({
      op: Op.ACCEPT,
    });
  }

  visitPattern(node) {
    this.markMatchStart(0);
    this.visit(node.Disjunction);
    this.markMatchEnd(0);
    this.accept();
  }

  visitDisjunction(node) {
    const end = this.label();
    let d = node;
    while (true) {
      if (d.Disjunction) {
        const tail = this.label();
        this.fork(tail);
        this.visit(d.Alternative);
        this.jump(end);
        this.bind(tail);

        d = d.Disjunction;
      } else {
        this.visit(d.Alternative);

        break;
      }
    }
    this.bind(end);
  }

  visitAlternative(node) {
    if (node.Alternative === undefined && node.Term === undefined) {
      return;
    }
    this.visit(node.Alternative);
    this.visit(node.Term);
  }

  visitTerm(node) {
    if (node.Quantifier) {
      const emit = () => {
        // clear group match?
        this.visit(node.Atom);
      };

      let min;
      let max;
      switch (node.Quantifier.QuantifierPrefix) {
        case '*':
          min = 0;
          max = Infinity;
          break;
        case '+':
          min = 1;
          max = Infinity;
          break;
        case '?':
          min = 0;
          max = 1;
          break;
        default: {
          const {
            DecimalDigits_a: a,
            DecimalDigits_b: b,
          } = node.Quantifier.QuantifierPrefix;
          min = a;
          max = b || a;
          break;
        }
      }
      const repetition = max - min;
      for (let i = 0; i < min; i += 1) {
        emit();
      }
      if (node.Quantifier.greedy) {
        if (max === Infinity) {
          const begin = this.label();
          const end = this.label();
          this.bind(begin);
          this.fork(end);
          emit();
          this.jump(begin);
          this.bind(end);
        } else {
          const end = this.label();
          for (let i = 0; i < repetition; i += 1) {
            this.fork(end);
            emit();
          }
          this.bind(end);
        }
      } else {
        // eslint-disable-next-line no-lonely-if
        if (max === Infinity) {
          const body = this.label();
          const end = this.label();
          this.fork(body);
          this.jump(end);
          this.bind(body);
          emit();
          this.fork(body);
          this.bind(end);
        } else {
          const end = this.label();
          for (let i = 0; i < repetition; i += 1) {
            const body = this.label();
            this.fork(body);
            this.jump(end);
            this.bind(body);
            emit();
          }
          this.bind(end);
        }
      }
    } else {
      this.visit(node.Atom);
    }
  }

  visitAssertion(node) {
    switch (node.subtype) {
      case '^':
      case '$':
      case 'b':
      case 'B':
        this.assertion(node.subtype);
        break;
      default:
        throw new RangeError(node.subtype);
    }
  }

  visitAtom(node) {
    switch (true) {
      case !!node.PatternCharacter: {
        const c = node.PatternCharacter.codePointAt(0);
        this.consumeRange(c, c);
        break;
      }
      case node.subtype === '.':
        if (this.flags.includes('s')) {
          this.consumeRange(0, 0x10FFFF);
        } else {
          this.consumeRanges(complement([
            [0x000A, 0x000A],
            [0x000D, 0x000D],
            [0x2028, 0x2029],
          ]));
        }
        break;
      case !!node.CharacterClass:
        this.visit(node.CharacterClass);
        break;
      case node.capturing: {
        const index = node.capturingParenthesesBefore + 1;
        this.markMatchStart(index);
        this.visit(node.Disjunction);
        this.markMatchEnd(index);
        break;
      }
      case !!node.Disjunction:
        this.visit(node.Disjunction);
        break;
      default:
        throw new RangeError(node);
    }
  }

  visitAtomEscape(node) {
    switch (true) {
      case !!node.DecimalEscape:
      case !!node.CharacterEscape:
      case !!node.CharacterClassEscape: {
        const ranges = this.toRange(node.CharacterClassEscape);
        this.consumeRanges(ranges);
        break;
      }
      case !!node.GroupName:
      default:
        throw new RangeError(node);
    }
  }

  visitCharacterClass(node) {
    const ranges = [];
    node.ClassRanges.forEach((range) => {
      if (Array.isArray(range)) {
        const c1 = this.engine262.CharacterValue(range[0]);
        const c2 = this.engine262.CharacterValue(range[1]);
        ranges.push([c1, c2]);
      } else {
        this.toRange(range).forEach((r) => {
          ranges.push(r);
        });
      }
    });
    canonicalize(ranges);

    if (node.invert) {
      this.consumeRanges(complement(ranges));
    } else {
      this.consumeRanges(ranges);
    }
  }

  toRange(node) {
    switch (node.type) {
      case 'ClassAtom':
        return this.toRangeClassAtom(node);
      case 'CharacterClassEscape':
        return this.toRangeCharacterClassEscape(node);
      default:
        throw new RangeError(node.type);
    }
  }

  toRangeClassAtom(node) {
    if (node.SourceCharacter) {
      const c = node.SourceCharacter.codePointAt(0);
      return [[c, c]];
    }
    throw new RangeError(node);
  }

  toRangeCharacterClassEscape(node) {
    switch (node.value) {
      case 'd':
        return [[
          '0'.codePointAt(0),
          '9'.codePointAt(0),
        ]];
      case 'D':
        return complement(this.toRangeCharacterClassEscape({ value: 'd' }));
      case 's':
        return [
          // WhiteSpace
          [0x0009, 0x0009],
          [0x000B, 0x000C],
          [0x0020, 0x0020],
          [0x00A0, 0x00A0],
          [0xFEFF, 0xFEFF],
          // LineTerminator
          [0x000A, 0x000A],
          [0x000D, 0x000D],
          [0x2028, 0x2029],
        ];
      case 'S':
        return complement(this.toRangeCharacterClassEscape({ value: 's' }));
      case 'w':
      case 'W':
        return complement(this.toRangeCharacterClassEscape({ value: 'w' }));
      case 'p':
        return this.toRangeUnicodePropertyValueExpression(node.UnicodePropertyValueExpression);
      case 'P':
        return complement(
          this.toRangeUnicodePropertyValueExpression(node.UnicodePropertyValueExpression),
        );
      default:
        throw new RangeError(node.value);
    }
  }

  toRangeUnicodePropertyValueExpression(node) {
    let p;
    let v;
    if (node.LoneUnicodePropertyNameOrValue) {
      const s = node.LoneUnicodePropertyNameOrValue;
      if (this.engine262.UnicodeMatchPropertyValue('General_Category', s)) {
        p = 'General_Category';
        v = s;
      } else {
        p = this.engine262.UnicodeMatchProperty(s);
        v = undefined;
      }
    } else {
      const ps = node.UnicodePropertyName;
      p = this.engine262.UnicodeMatchProperty(ps);
      const vs = node.UnicodePropertyValue;
      v = this.engine262.UnicodeMatchPropertyValue(p, vs);
    }
    const path = v ? `${p}/${v}` : `Binary_Property/${p}`;
    return this.engine262.UnicodeSets[path];
  }
}

module.exports = { BytecodeGenerator };
