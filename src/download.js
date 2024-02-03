"use strict";

import fs from "fs";
import net from "net";
import { Buffer } from "buffer";

import * as tracker from "./tracker.js";
import * as message from "./message.js";
import Pieces from "./Pieces.js";
import Queue from "./Queue.js";

export default function (torrent, path) {
  tracker.getPeers(torrent, (peers) => {
    console.log(torrent.info.files);

    const pieces = new Pieces(torrent);
    // console.log("\n====== initial pieces arrray =====", pieces);

    fs.mkdir(path, (err) => {
      if (err) {
        console.log({ error_while_creating_download_directory: err });
        return;
      }
    });

    // todo: take into account the file structure where file are present in
    // the direcories recursively

    const files = initializeFiles(torrent, path);
    console.log({ files });
    files.forEach((file) => {
      file.descriptor = fs.openSync(file.path, "w");
    });

    peers.forEach((peer) => download(peer, torrent, pieces, files));
  });
}

function initializeFiles(torrent, path) {
  const files = [];
  const nFiles = torrent.info.files.length;
  const directorypath = new TextDecoder().decode(path);

  let offset = 0;

  for (let i = 0; i < nFiles; i++) {
    const filename = new TextDecoder().decode(torrent.info.files[i].path[0]);
    const filepath = `${directorypath}/${filename}`;
    const fileLength = torrent.info.files[i].length;

    files.push({
      path: filepath,
      length: fileLength,
      descriptor: null,
      offset: offset,
    });

    // calculate the starting piece index for each file based on the
    // cumulative piece indices of the preceding files
    offset += Math.floor(fileLength / torrent.info["piece length"]);
  }

  return files;
}

function download(peer, torrent, pieces, files) {
  const socket = new net.Socket();

  socket.on("error", (err) => {
    return { tcp_peer_connect_error: err };
  });

  socket.connect(peer.port, peer.ip, () => {
    console.log("\n===== connecting with peer: " + peer.ip + " =====\n");
    socket.write(message.buildHandshake(torrent));
  });

  // queue is a list per connection that contains
  // all the pieces that a single peer has
  const queue = new Queue(torrent);

  onWholeMessage(socket, (msg) => {
    // console.log("\n******* received complete message *******\n");
    messageHandler(msg, socket, pieces, queue, torrent, files);
  });
}

function onWholeMessage(socket, callback) {
  let savedBuffer = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (receivedBuffer) => {
    // msgLength calculates the length of whole message in bytes
    function msgLength() {
      return handshake
        ? savedBuffer.readUInt8(0) + 49
        : savedBuffer.readInt32BE(0) + 4;
    }
    savedBuffer = Buffer.concat([savedBuffer, receivedBuffer]);

    while (savedBuffer.length >= 4 && savedBuffer.length >= msgLength()) {
      callback(savedBuffer.subarray(0, msgLength()));
      savedBuffer = savedBuffer.subarray(msgLength()); // clear saved buffer
      handshake = false;
    }
  });
}

function messageHandler(msg, socket, pieces, queue, torrent, files) {
  if (isHandshake(msg)) {
    // console.log("\n===== handshake successfull =====\n");

    socket.write(message.buildInterested());
  } else {
    const parsedMsg = message.parse(msg);
    // console.log({ parsedMsg });

    switch (parsedMsg.id) {
      case 0: {
        // console.log({ choked_msg_received: parsedMsg });
        chokeHandler(socket);
        break;
      }
      case 1: {
        // console.log({ unchoked_msg_received: parsedMsg });
        unchokeHandler(socket, pieces, queue);
        break;
      }
      case 4: {
        // console.log({ have_msg_received: parsedMsg });
        haveHandler(socket, pieces, queue, parsedMsg.payload);
        break;
      }
      case 5: {
        // console.log({ bitfield_msg_received: parsedMsg });
        bitfieldHandler(socket, pieces, queue, parsedMsg.payload);
        break;
      }
      case 7: {
        // console.log({ pieceblock_msg_received: parsedMsg });
        pieceHandler(socket, pieces, queue, torrent, files, parsedMsg.payload);
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
      if (byte % 2) queue.queue(i * 8 + 7 - j); // if the bit is set bit enqueue the piece
      byte = Math.floor(byte / 2);
    }
  });

  if (queueEmpty) requestPiece(socket, pieces, queue);
}

function pieceHandler(socket, pieces, queue, torrent, files, pieceBlock) {
  const fileIndex = findFileIndex(torrent, files, pieceBlock.index);

  console.log({ fileIndex, pieceBlock });

  const file = files[fileIndex];
  // calculate relative piece index within the file
  const relativePieceIndex = pieceBlock.index - file.offset;

  pieces.addReceived(pieceBlock);

  // write to file here
  const offset =
    file.offset +
    relativePieceIndex * torrent.info["piece length"] +
    pieceBlock.begin;

  fs.write(
    file.descriptor,
    pieceBlock.block,
    0,
    pieceBlock.block.length,
    offset,
    () => {}
  );

  if (pieces.isDone()) {
    console.log("\n********** DOWNLOAD COMPLETE **********");
    socket.end();
    try {
      fs.closeSync(file.descriptor);
      process.exit(0);
    } catch (err) {
      console.log({ error_while_closing_file: err });
    }
  } else {
    process.stdout.write(
      `downloading... ${(
        (pieces.totalReceivedBlocks / pieces.totalBlocks) *
        100
      ).toPrecision(3)}%`
    );
    process.stdout.cursorTo(0);

    requestPiece(socket, pieces, queue);
  }
}

function findFileIndex(torrent, files, pieceIndex) {
  let offset = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const piecesInFile = Math.ceil(file.length / torrent.info["piece length"]);

    if (pieceIndex < offset + piecesInFile) {
      return i;
    }

    offset += piecesInFile;
  }

  return -1; // error: piece index does not correspond to any file
}

function requestPiece(socket, pieces, queue) {
  if (queue.choked) return null;

  while (queue.length()) {
    const pieceBlock = queue.deque(); // pick first piece from queue
    if (pieces.needed(pieceBlock)) {
      // if the piece is not requested yet
      // console.log("\n===== requesting piece block =====", pieceBlock);
      socket.write(message.buildRequest(pieceBlock)); // request the piece
      pieces.addRequested(pieceBlock); // add it to the requested pieces array
      break;
    }
  }
}
