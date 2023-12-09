"use strict";

import fs from "fs";
import bencode from "bencode";

import * as tracker from "./tracker";
import * as torrentParser from "./torrent-parser";

const torrent = torrentParser.open("puppy.torrent");

tracker.getPeers(torrent, (peers) => {
  console.log({ peers });
});
