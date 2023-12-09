"use strict";

import fs from "fs";
import bencode from "bencode";

export function open(filePath) {
  return bencode.decode(fs.readFileSync(filePath));
}

export function size(torrent) {}

export function infoHash(torrent) {}
