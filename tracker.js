"use strict";

import dgram from "dgram";
import { Buffer } from "buffer";
import { URL } from "url";

export const getPeers = (torrent, callback) => {
  const socket = dgram.createSocket("udp4");
  const torrentUrlObj = new URL(torrent.announce.toString("utf8"));

  // 1. send connect request
  udpSend(socket, buildConnectReq(), torrentUrlObj);

  socket.on("message", (response) => {
    if (respType(response) === "connect") {
      // 2. receive and parse the connect response
      const connResp = parseConnectResp(response);

      // 3. send announce request
      const announceReq = buildAnnounceReq(connResp.connectionId);
      udpSend(socket, announceReq, torrentUrlObj);
    } else if (respType(response) === "announce") {
      // 4. parse announce response
      const announceResp = parseAnnounceResp(response);
      // 5. pass peers to callback
      callback(announceResp.peers);
    }
  });
};

function udpSend(socket, message, urlObj, callback = () => {}) {
  socket.send(message, 0, message.length, urlObj.port, urlObj.host, callback);
}

function respType(resp) {}

function buildConnectReq() {}

function parseConnectResp(resp) {}

function buildAnnounceReq(connId) {}

function parseAnnounceResp(resp) {}
