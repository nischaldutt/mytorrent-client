"use strict";

import net from "net";
import { Buffer } from "buffer";

import * as tracker from "./tracker.js";
import * as message from "./message.js";

export default function (torrent) {
  const requested = [];

  tracker.getPeers(torrent, (peers) => {
    peers.forEach((peer) => download(peer, torrent, requested));
  });
}

function download(peer, torrent, requested) {
  const socket = net.Socket();
  const queue = [];

  socket.on("error", console.log);

  socket.connnect(peer.port, peer.ip, () => {
    socket.write(message.buildHandshake(torrent));
  });

  onWholeMessage(socket, (msg) => {
    messageHandler(msg, socket, requested, queue);
  });
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

function messageHandler(msg, socket, requested, queue) {
  if (isHandshake(msg)) {
    socket.write(message.buildInterested());
  } else {
    const parsedMsg = message.parse(msg);

    switch (parsedMsg.id) {
      case 0: {
        chokeHandler();
        break;
      }
      case 1: {
        unchokeHandler();
        break;
      }
      case 4: {
        haveHandler(parsedMsg.payload, socket, requested, queue);
        break;
      }
      case 5: {
        bitfieldHandler(parsedMsg.payload);
        break;
      }
      case 7: {
        pieceHandler(parsedMsg.payload, socket, requested, queue);
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

function chokeHandler() {}

function unchokeHandler() {}

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

function requestPiece(socket, requested, queue) {
  if (requested[queue[0]]) {
    queue.shift();
  } else {
    socket.write(message.buildRequest(pieceIndex));
  }
}
