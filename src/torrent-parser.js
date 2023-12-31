"use strict";

import fs from "fs";
import bencode from "bencode";
import crypto from "crypto";
import { toBufferBE, toBigIntBE } from "bigint-buffer";

export function open(filePath) {
  // console.log(bencode.decode(fs.readFileSync(filePath), "utf8"));
  return bencode.decode(fs.readFileSync(filePath));
}

export function size(torrent) {
  const size = torrent.info.files
    ? torrent.info.files
        .map((file) => file.length)
        .reduce((acc, curr) => acc + curr)
    : torrent.info.length;

  // file size might be larger than 32-bit integer
  return toBufferBE(size, 8);
}

export function infoHash(torrent) {
  const info = bencode.decode(torrent.info);
  return crypto.createHash("sha1").update(info).digest();
}

export const BLOCK_LENGTH = Math.pow(2, 14);

export function pieceLen(torrent, pieceIndex) {
  const totalLength = toBigIntBE(size(torrent));
  const pieceLength = torrent.info["piece length"];
  const lastPieceLength = totalLength % pieceLength;
  const lastPieceIndex = Math.floor(totalLength / pieceLength);

  return lastPieceIndex === pieceIndex ? lastPieceLength : pieceLength;
}

export function blocksPerPiece(torrent, pieceIndex) {
  const pieceLength = pieceLen(torrent, pieceIndex);
  return Math.ceil(pieceLength / BLOCK_LENGTH);
}

export function blockLen(torrent, pieceIndex, blockIndex) {
  const pieceLength = pieceLen(torrent, pieceIndex);
  const lastBlockLength = pieceLength % BLOCK_LENGTH;
  const lastBlockIndex = Math.floor(pieceLength / BLOCK_LENGTH);

  return blockIndex === lastBlockIndex ? lastBlockLength : BLOCK_LENGTH;
}
