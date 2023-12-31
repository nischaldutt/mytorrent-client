"use strict";

import * as torrentParser from "./torrent-parser.js";

export default class Queue {
  constructor(torrent) {
    // "_" signifies private variables
    this._torrent = torrent; // private
    // queue is a list per connection that contains
    // all the pieces that a single peer has
    this._queue = []; // private
    this.choked = true; // public
  }

  queue(pieceIndex) {
    const nBlocks = torrentParser.blocksPerPiece(this._torrent, pieceIndex);

    for (let i = 0; i < nBlocks; i++) {
      const pieceBlock = {
        index: pieceIndex,
        begin: i * torrentParser.BLOCK_LENGTH,
        length: torrentParser.blockLen(this._torrent, pieceIndex, i),
      };
      this._queue.push(pieceBlock);
    }
  }

  deque() {
    return this._queue.shift();
  }

  peek() {
    return this._queue[0];
  }

  length() {
    return this._queue.length;
  }
}
