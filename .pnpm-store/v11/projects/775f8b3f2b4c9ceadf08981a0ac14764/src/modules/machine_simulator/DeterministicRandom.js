class DeterministicRandom {
  constructor(seed = 1) {
    const normalized = Number(seed) >>> 0;
    this.state = normalized || 1;
  }

  next() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

module.exports = { DeterministicRandom };
