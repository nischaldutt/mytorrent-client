"use strict";

import dgram from "dgram";
import buffer from "buffer";
import { URL } from "url";

const Buffer = buffer.Buffer;
const torrentUrlObj = new URL("udp://tracker.coppersurfer.tk:6969/announce");

console.log({ torrentUrlObj });

export const getPeers = (torrent, callback) => {
  const socket = dgram.createSocket("udp4");
  const torrentUrlObj = new URL(torrent.announce.toString("utf8"));

  // 1. send connect request
  // udpSend(socket, buildConnectReq(), torrentUrlObj);
};

function udpSend(socket, message, urlObj, callback = () => {}) {
  socket.send(message, 0, message.length, urlObj.port, urlObj.host, callback);
}
