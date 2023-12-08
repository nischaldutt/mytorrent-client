"use strict";

import fs from "fs";
import bencode from "bencode";

import * as tracker from "./tracker";

const torrent = bencode.decode(fs.readFileSync("puppy.torrent"));

tracker.getPeers(torrent, (peers) => {
  console.log({ peers });
});
