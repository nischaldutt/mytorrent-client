"use strict";

import net from "net";
import { Buffer } from "buffer";

import * as tracker from "./tracker.js";
import * as message from "./message.js";
import Pieces from "./Pieces.js";

export default function (torrent) {
  tracker.getPeers(torrent, (peers) => {
    // torrent.info.pieces is a buffer that contains 20-byte SHA-1 hash of each piece,
    // and the length gives you the total number of bytes in the buffer.
    const pieces = new Piece(torrent.info.pieces.length / 20);
    peers.forEach((peer) => download(peer, torrent, pieces));
  });
}

function download(peer, torrent, pieces) {
  const socket = net.Socket();

  socket.on("error", console.log);

  socket.connnect(peer.port, peer.ip, () => {
    socket.write(message.buildHandshake(torrent));
  });

  // queue is a list per connection that contains
  // all the pieces that a single peer has
  const queue = { choked: true, queue: [] };
  onWholeMessage(socket, (msg) => {
    messageHandler(msg, socket, pieces, queue);
  });
}

function onWholeMessage(socket, callback) {
  let savedBuffer = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (recievedBuffer) => {
    // msgLength calculates the length of whole message in bytes
    function msgLength() {
      return handshake
        ? savedBuffer.readUInt8(0) + 49
        : savedBuffer.readInt32BE(0) + 4;
    }
    savedBuffer = Buffer.concat([savedBuffer, recievedBuffer]);

    while (savedBuffer.length >= 4 && savedBuffer.length >= msgLength()) {
      callback(savedBuffer.subarray(0, msgLength()));
      savedBuffer = savedBuffer.subarray(msgLength());
      handshake = false;
    }
  });
}

function messageHandler(msg, socket, pieces, queue) {
  if (isHandshake(msg)) {
    socket.write(message.buildInterested());
  } else {
    const parsedMsg = message.parse(msg);

    switch (parsedMsg.id) {
      case 0: {
        chokeHandler(socket);
        break;
      }
      case 1: {
        unchokeHandler(socket, pieces, queue);
        break;
      }
      case 4: {
        haveHandler(parsedMsg.payload, socket, pieces, queue);
        break;
      }
      case 5: {
        bitfieldHandler(parsedMsg.payload);
        break;
      }
      case 7: {
        pieceHandler(parsedMsg.payload, socket, pieces, queue);
        break;
      }
    }
  }
}

function isHandshake(msg) {
  return (
    msg.length === msg.readUInt8(0) + 49 &&
    msg.toString("utf8", 1) === "BitTorrent protocol"
  );
}

function chokeHandler(socket) {
  socket.end();
}

function unchokeHandler(socket, pieces, queue) {
  queue.choked = false;
  requestPiece(socket, pieces, queue);
}

function haveHandler(payload, socket, requested, queue) {
  const pieceIndex = payload.readUInt32BE(0);

  queue.push(pieceIndex);
  if (queue.length === 1) {
    requestPiece(socket, requested, queue);
  }

  if (!requested[pieceIndex]) {
    // socket.write(message.buildRequest(payload));
  }
  requested[pieceIndex] = true;
}

function bitfieldHandler(payload) {}

function pieceHandler(payload, socket, requested, queue) {
  queue.shift();
  requestPiece(socket, requested, queue);
}

function requestPiece(socket, pieces, queue) {
  if (queue.choked) return null;

  while (queue.queue.length) {
    const pieceIndex = queue.shift();
    if (pieces.needed(pieceIndex)) {
      socket.write(message.buildRequest(pieceIndex));
      pieces.addRequested(pieceIndex);
      break;
    }
  }
}
