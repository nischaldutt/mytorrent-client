"use strict";

import fs from "fs";
import bencode from "bencode";
import crypto from "crypto";
import { toBufferBE, toBigIntBE } from "bigint-buffer";

export function open(filePath) {
  console.log("====== opening the torrent file ======");
  const torrent = bencode.decode(fs.readFileSync(filePath), "utf8");
  console.log({ torrent });
  return bencode.decode(fs.readFileSync(filePath));
}

export function size(torrent) {
  const size = torrent.info.files
    ? torrent.info.files
        .map((file) => file.length)
        .reduce((acc, curr) => acc + curr, 0)
    : torrent.info.length;

  // file size might be larger than 32-bit integer
  return toBufferBE(BigInt(size), 8);
}

export function infoHash(torrent) {
  // to uniquely identify the torrent
  const info = bencode.encode(torrent.info);
  return crypto.createHash("sha1").update(info).digest();
}

export const BLOCK_LENGTH = Math.pow(2, 14);

export function pieceLen(torrent, pieceIndex) {
  const totalLength = Number(toBigIntBE(size(torrent)));
  const pieceLength = torrent.info["piece length"];
  // console.log({ totalLength, pieceLength });

  const lastPieceLength = totalLength % pieceLength;
  const lastPieceIndex = Math.floor(totalLength / pieceLength);
  // console.log({
  //   lastPieceIndex: Math.floor(totalLength / pieceLength),
  //   lastPieceLength,
  // });

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
