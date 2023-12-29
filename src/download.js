"use strict";

import net from "net";
import { Buffer } from "buffer";

import * as tracker from "./tracker.js";
import * as message from "./message.js";
import Pieces from "./Pieces.js";
import Queue from "./Queue.js";

export default function (torrent) {
  tracker.getPeers(torrent, (peers) => {
    const pieces = new Pieces(torrent);
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
  const queue = new Queue(torrent);
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

function haveHandler(socket, pieces, queue, payload) {
  const pieceIndex = payload.readUInt32BE(0);
  const queueEmpty = queue.length === 0;

  queue.queue(pieceIndex);

  if (queueEmpty) requestPiece(socket, pieces, queue);
}

function bitfieldHandler(socket, pieces, queue, payload) {
  const queueEmpty = queue.length === 0;

  payload.forEach((byte, i) => {
    for (let j = 0; j < 8; j++) {
      if (byte % 2) queue.queue(i * 8 + 7 - j);
      byte = Math.floor(byte / 2);
    }
  });

  if (queueEmpty) requestPiece(socket, pieces, queue);
}

function pieceHandler(payload, socket, requested, queue) {
  queue.shift();
  requestPiece(socket, requested, queue);
}

function requestPiece(socket, pieces, queue) {
  if (queue.choked) return null;

  while (queue.length()) {
    const pieceBlock = queue.deque();
    if (pieces.needed(pieceBlock)) {
      socket.write(message.buildRequest(pieceBlock));
      pieces.addRequested(pieceBlock);
      break;
    }
  }
}
