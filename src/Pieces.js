"use strict";

import * as torrentParser from "./torrent-parser.js";

export default class Pieces {
  constructor(torrent) {
    /*
     *  @returns
     *  an array of arrays, where the inner arrays hold the status
     *  of a block at a give piece index. So if you wanted to find
     *  out the status of a block at index 1 for a piece at index 7,
     *  you could look up _requested[7][1] and check if it’s set to true
     */
    function buildPiecesArray() {
      // torrent.info.pieces is a buffer that contains 20-byte SHA-1 hash of each piece,
      // and the length gives you the total number of bytes in the buffer.
      const nPieces = torrent.info.pieces.length / 20;
      const arr = new Array(nPieces).fill(null);
      return arr.map((_, i) =>
        new Array(torrentParser.blocksPerPiece(torrent, i)).fill(false)
      );
    }

    this._requested = buildPiecesArray();
    this._received = buildPiecesArray();
  }

  addRequested(pieceBlock) {
    const blockIndex = pieceBlock.begin / torrentParser.BLOCK_LENGTH;
    this._requested[pieceBlock.index][blockIndex] = true;
  }

  addReceived(pieceBlock) {
    const blockIndex = pieceBlock.begin / torrentParser.BLOCK_LENGTH;
    this._received[pieceBlock.index][blockIndex] = true;
  }

  needed(pieceBlock) {
    // check if every block has been requested once
    if (this._requested.every((blocks) => blocks.every((i) => i))) {
      // then copy received to requested
      // using slice() method here to return a copy of an array
      this._requested = this._received.map((blocks) => blocks.slice());
    }

    const blockIndex = pieceBlock.begin / torrentParser.BLOCK_LENGTH;
    return !this._requested[pieceBlock.index][blockIndex];
  }

  isDone() {
    return this._received.every((blocks) => blocks.every((i) => i));
  }
}
