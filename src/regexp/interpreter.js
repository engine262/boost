'use strict';

const Op = {
  JUMP: 0,
  FORK: 1,
  CONSUME_RANGE: 2,
  ACCEPT: 3,
  ASSERTION: 4,
  MARK_MATCH_START: 5,
  MARK_MATCH_END: 6,
};

const isLineTerminator = (c) => c === 0x000A || c === 0x000D || c === 0x2028 || c === 0x2029;
const isRegExpWord = (c) => {
  if (c >= 0x0061 && c <= 0x007A) {
    return true;
  }
  if (c >= 0x0041 && c <= 0x005A) {
    return true;
  }
  if (c >= 0x0030 && c <= 0x0039) {
    return true;
  }
  return false;
};

class Thread {
  constructor(pc, matches) {
    this.pc = pc;
    this.matches = matches;
  }
}

class Interpreter {
  constructor(code, input, index) {
    this.input = input;
    this.inputIndex = index;
    this.code = code;
    this.activeThreads = [];
    this.blockedThreads = [];
    this.bestMatches = null;
    this.pcLastInputIndex = Array.from({ length: code.length }, () => -1);
  }

  isPcProcessed(pc) {
    return this.pcLastInputIndex[pc] === this.inputIndex;
  }

  markPcProcessed(pc) {
    this.pcLastInputIndex[pc] = this.inputIndex;
  }

  runActiveThreads() {
    while (this.activeThreads.length > 0) {
      this.runThread(this.activeThreads.pop());
    }
  }

  runThread(thread) {
    while (true) {
      if (this.isPcProcessed(thread.pc)) {
        return;
      }
      this.markPcProcessed(thread.pc);

      const instr = this.code[thread.pc];
      switch (instr.op) {
        case Op.FORK: {
          const t = new Thread(instr.pc, thread.matches.slice());
          this.activeThreads.push(t);
          thread.pc += 1;
          break;
        }
        case Op.JUMP:
          thread.pc = instr.pc;
          break;
        case Op.CONSUME_RANGE:
          this.blockedThreads.push(thread);
          return;
        case Op.ACCEPT:
          this.activeThreads = [];
          this.bestMatches = thread.matches;
          return;
        case Op.ASSERTION:
          if (!this.checkAssertion(instr.type)) {
            return;
          }
          thread.pc += 1;
          break;
        case Op.MARK_MATCH_START:
          thread.matches[instr.index * 2] = this.inputIndex;
          thread.pc += 1;
          break;
        case Op.MARK_MATCH_END:
          thread.matches[(instr.index * 2) + 1] = this.inputIndex;
          thread.pc += 1;
          break;
        default:
          throw new RangeError(instr.op);
      }
    }
  }

  checkAssertion(type) {
    switch (type) {
      case '^':
        return this.inputIndex === 0;
      case '$':
        return this.inputIndex === this.input.length;
      case '^n':
        if (this.inputIndex === 0) {
          return true;
        }
        return isLineTerminator(this.input[this.inputIndex - 1]);
      case '$n':
        if (this.inputIndex === this.input.length) {
          return true;
        }
        return isLineTerminator(this.input[this.inputIndex]);
      case 'b':
        if (this.input.length === 0) {
          return false;
        }
        if (this.inputIndex === 0) {
          return isRegExpWord(this.input[this.inputIndex]);
        }
        if (this.inputIndex === this.input.length) {
          return isRegExpWord(this.input[this.inputIndex - 1]);
        }
        return isRegExpWord(this.input[this.inputIndex - 1])
          !== isRegExpWord(this.input[this.inputIndex]);
      case 'B':
        return !this.checkAssertion('b');
      default:
        throw new RangeError(type);
    }
  }

  flushBlockedThreads(inputChar) {
    for (let i = this.blockedThreads.length - 1; i >= 0; i -= 1) {
      const thread = this.blockedThreads[i];

      const instr = this.code[thread.pc];
      if (instr.op !== Op.CONSUME_RANGE) {
        throw new RangeError();
      }
      if (inputChar >= instr.min && inputChar <= instr.max) {
        thread.pc += 1;
        this.activeThreads.push(thread);
      }
    }
    this.blockedThreads = [];
  }

  foundMatch() {
    return this.bestMatches !== null;
  }

  findNextMatch() {
    this.activeThreads.push(new Thread(0, []));
    this.runActiveThreads();
    while (this.inputIndex !== this.input.length
           && !(this.foundMatch() && this.blockedThreads.length === 0)) {
      const inputChar = this.input[this.inputIndex];
      this.inputIndex += 1;
      this.flushBlockedThreads(inputChar);
      this.runActiveThreads();
    }
  }

  findMatches(maxMatchNum) {
    let matchNum = 0;

    while (matchNum < maxMatchNum) {
      this.findNextMatch();
      if (!this.foundMatch()) {
        break;
      }
      matchNum += 1;

      const [matchBegin, matchEnd] = this.bestMatches;
      const matchLength = matchEnd - matchBegin;
      if (matchLength !== 0) {
        this.inputIndex = matchEnd;
      } else if (matchEnd === this.input.length) {
        this.inputIndex = matchEnd;
        break;
      } else {
        this.inputIndex = matchEnd + 1;
      }
    }

    return matchNum;
  }
}

module.exports = { Interpreter, Op };
