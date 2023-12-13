"use strict";

import fs from "fs";
import bencode from "bencode";

import * as tracker from "./src/tracker.js";
import * as torrentParser from "./src/torrent-parser.js";
import * as download from "./src/download.js";

const torrent = torrentParser.open(process.argv[2]);

// tracker.getPeers(torrent, (peers) => {
//   console.log({ peers });
// });
