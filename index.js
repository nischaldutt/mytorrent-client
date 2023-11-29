"use strict";

const fs = require("fs");
const torrent = fs.readFileSync("puppy.torrent");

console.log(torrent.toString("utf8"));
