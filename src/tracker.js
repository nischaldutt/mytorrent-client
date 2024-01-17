"use strict";

import dgram from "dgram";
import crypto from "crypto";
import { Buffer } from "buffer";
import { URL } from "url";

import * as util from "./util.js";
import * as torrentParser from "./torrent-parser.js";

export const getPeers = (torrent, callback) => {
  const socket = dgram.createSocket("udp4");
  const torrentUrlObj = new URL(new TextDecoder().decode(torrent.announce));
  // console.log({ torrentUrlObj });

  // 1. send connect request
  udpSend(socket, buildConnectReq(), torrentUrlObj);

  socket.on("message", (response) => {
    if (respType(response) === "connect") {
      // 2. receive and parse the connect response
      const connResp = parseConnectResp(response);
      console.log("\n===== received connect response =====\n", connResp);

      // 3. send announce request
      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      udpSend(socket, announceReq, torrentUrlObj);
    } else if (respType(response) === "announce") {
      // 4. parse announce response
      const announceResp = parseAnnounceResp(response);
      console.log("\n===== received announce response =====\n", announceResp);

      // 5. pass peers to callback
      callback(announceResp.peers);
    }
  });
};

function udpSend(
  socket,
  message,
  urlObj,
  callback = (err) => {
    console.log({ udp_send_error: err });
  }
) {
  socket.send(
    message,
    0,
    message.length,
    urlObj.port,
    urlObj.hostname,
    callback
  );
}

function respType(resp) {
  const action = resp.readUInt32BE(0);
  if (action === 0) return "connect";
  if (action === 1) return "announce";
}

function buildConnectReq() {
  const buf = Buffer.alloc(16);

  // connection id
  buf.writeUInt32BE(0x417, 0);
  buf.writeUInt32BE(0x27101980, 4);

  // action
  buf.writeUInt32BE(0, 8);

  // transaction id
  crypto.randomBytes(4).copy(buf, 12);

  return buf;
}

function parseConnectResp(resp) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8),
  };
}

function buildAnnounceReq(connId, torrent, port = 6881) {
  const buf = Buffer.allocUnsafe(98);

  // connection id
  connId.copy(buf, 0);

  // action
  buf.writeUInt32BE(1, 8);

  // transaction id
  crypto.randomBytes(4).copy(buf, 12);

  // info hash
  torrentParser.infoHash(torrent).copy(buf, 16);

  // peer id
  util.genId().copy(buf, 36);

  // downloaded
  Buffer.alloc(8).copy(buf, 56);

  // left
  torrentParser.size(torrent).copy(buf, 64);

  // uploaded
  Buffer.alloc(8).copy(buf, 72);

  // event
  // 0: none; 1: completed; 2: started; 3: stopped
  buf.writeUInt32BE(0, 80);

  // ip address
  // 0 default
  buf.writeUInt32BE(0, 84);

  // key
  crypto.randomBytes(4).copy(buf, 88);

  // num want
  // -1 default
  buf.writeInt32BE(-1, 92);

  // port
  buf.writeUInt16BE(port, 96);

  return buf;
}

function parseAnnounceResp(resp) {
  function group(iterable, groupSize) {
    let groups = [];
    for (let i = 0; i < iterable.length; i += groupSize) {
      groups.push(iterable.slice(i, i + groupSize));
    }
    return groups;
  }

  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    leecher: resp.readUInt32BE(8),
    seeders: resp.readUInt32BE(12),
    peers: group(resp.slice(20), 6).map((address) => {
      return {
        ip: address.slice(0, 4).join("."),
        port: address.readUInt16BE(4),
      };
    }),
  };
}
