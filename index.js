"use strict";

import * as torrentParser from "./src/torrent-parser.js";
import download from "./src/download.js";

const torrent = torrentParser.open(process.argv[2]);

download(torrent, torrent.info.name);
