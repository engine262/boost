'use strict';

const Op = {
  JUMP: 0,
  FORK: 1,
  CONSUME_RANGE: 2,
  ACCEPT: 3,
  SET_REGISTER_TO_CP: 4,
  CLEAR_REGISTER: 5,
  ASSERTION: 6,
};

class Thread {
  constructor(pc, registers) {
    this.pc = pc;
    this.registers = registers;
  }
}

class Interpreter {
  constructor(code, input, index) {
    this.input = input;
    this.inputIndex = index;
    this.code = code;
    this.activeThreads = [];
    this.blockedThreads = [];
    this.bestMatchRegisters = null;
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
          const t = new Thread(instr.pc, thread.registers.slice());
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
          this.bestMatchRegisters = thread.registers;
          return;
        case Op.SET_REGISTER_TO_CP:
          thread.pc += 1;
          thread.registers[instr.register] = this.inputIndex;
          break;
        case Op.CLEAR_REGISTER:
          thread.pc += 1;
          thread.registers[instr.register] = -1;
          break;
        case Op.ASSERTION:
          switch (instr.type) {
            case '^':
              if (this.inputIndex !== 0) {
                return;
              }
              break;
            case '$':
              if (this.inputIndex !== this.input.length) {
                return;
              }
              break;
            case 'b':
            case 'B':
            default:
              throw new RangeError(instr.type);
          }
          thread.pc += 1;
          break;
        default:
          throw new RangeError(instr.op);
      }
    }
  }

  flushBlockedThreads(inputChar) {
    for (const thread of this.blockedThreads) {
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
    return this.bestMatchRegisters !== null;
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

      const matchBegin = this.bestMatchRegisters[0];
      const matchEnd = this.bestMatchRegisters[1];
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
