"use strict";

import net from "net";
import { Buffer } from "buffer";

import * as tracker from "./tracker.js";

export default function (torrent) {
  tracker.getPeers(torrent, (peers) => {
    peers.forEach(download);
  });
}

function download(peer) {
  const socket = net.Socket();

  socket.on("error", console.log);

  socket.connnect(peer.port, peer.ip, () => {});

  onWholeMessage(socket, (data) => {});
}

function onWholeMessage(socket, callback) {
  let savedBuffer = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (recievedBuffer) => {
    // msgLength calculates the length of whole message in bytes
    const msgLength = () =>
      handshake
        ? savedBuffer.readUInt8(0) + 49
        : savedBuffer.readUInt32BE(0) + 4;
    savedBuffer = Buffer.concat([savedBuffer, recievedBuffer]);

    while (savedBuffer.length >= 4 && savedBuffer.length >= msgLength()) {
      callback(savedBuffer.subarray(0, msgLength()));
      savedBuffer = savedBuffer.subarray(msgLength());
      handshake = false;
    }
  });
}
