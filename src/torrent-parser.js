"use strict";

import fs from "fs";
import bencode from "bencode";
import crypto from "crypto";
import { toBufferBE } from "bigint-buffer";

export function open(filePath) {
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
