"use strict";

export default class {
  constructor(size) {
    this.requested = new Array(size).fill(false);
    this.received = new Array(size).fill(false);
  }

  addRequested(pieceIndex) {
    this.requested[pieceIndex] = true;
  }

  addReceived(pieceIndex) {
    this.received[pieceIndex] = true;
  }

  needed(pieceIndex) {
    // check if every piece has been requested once
    if (this.requested.every((x) => x === true)) {
      // then copy received to requested
      // using slice() method here to return a copy of an array
      this.requested = this.received.slice();
    }
    return !this.requested[pieceIndex];
  }

  isDone() {
    return this.received.every((x) => x === true);
  }
}
