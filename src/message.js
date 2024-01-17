/*
 * BitTorrent Specification: https://wiki.theory.org/BitTorrentSpecification#Messages
 */

"use strict";

import { Buffer } from "buffer";

import * as util from "./util.js";
import * as torrentParser from "./torrent-parser.js";

/*
 * The handshake is a required message and must be the first message transmitted 
 * by the client. It is (49 + len(pstr)) bytes long.

 * handshake: <pstrlen><pstr><reserved><info_hash><peer_id>

 * pstrlen: string length of <pstr>, as a single raw byte
 * pstr: string identifier of the protocol
 * reserved: eight (8) reserved bytes. All current implementations use all zeroes.
 * peer_id: 20-byte string used as a unique ID for the client.

 * In version 1.0 of the BitTorrent protocol, pstrlen = 19, and pstr = "BitTorrent protocol". 
 */
export function buildHandshake(torrent) {
  const buf = Buffer.alloc(68);

  // pstrlen
  buf.writeUInt8(19, 0);

  // pstr
  buf.write("BitTorrent protocol", 1);

  // reserved
  buf.writeUInt32BE(0, 20);
  buf.writeUInt32BE(0, 24);

  // info hash
  torrentParser.infoHash(torrent).copy(buf, 28);

  // peer id
  util.genId().copy(buf, 48);

  return buf;
}

/* 
 * All of the remaining messages in the protocol take the form of 
 * <length prefix><message ID><payload>.

 * The length prefix is a four byte big-endian value. 
 * The message ID is a single decimal byte. 
 * The payload is message dependent.
*/

/*
 * keep-alive: <len=0000>
 * The keep-alive message is a message with zero bytes, specified with
 * the length prefix set to zero. There is no message ID and no payload.
 * Peers may close a connection if they receive no messages (keep-alive
 * or any other message) for a certain period of time, so a keep-alive
 * message must be sent to maintain the connection alive if no command
 * have been sent for a given amount of time. This amount of time is
 * generally two minutes.
 */
export function buildKeepAlive() {
  return Buffer.alloc(4);
}

/*
 * choke: <len=0001><id=0>
 * The choke message is fixed-length and has no payload.
 */
export function buildChoke() {
  const buf = Buffer.alloc(5);

  // length of the message
  buf.writeUInt32BE(1, 0);

  // id of the message
  buf.writeUInt8(0, 4);

  return buf;
}

/*
 * unchoke: <len=0001><id=1>
 * The unchoke message is fixed-length and has no payload.
 */
export function buildUnChoke() {
  const buf = Buffer.alloc(5);

  // length of the message
  buf.writeUInt32BE(1, 0);

  // id of the message
  buf.writeUInt8(1, 4);

  return buf;
}

/*
 * interested: <len=0001><id=2>
 * The interested message is fixed-length and has no payload.
 */
export function buildInterested() {
  const buf = Buffer.alloc(5);

  // length of the message
  buf.writeUInt32BE(1, 0);

  // id of the message
  buf.writeUInt8(2, 4);

  return buf;
}

/*
 * not interested: <len=0001><id=3>
 * The not interested message is fixed-length and has no payload.
 */
export function buildNotInterested() {
  const buf = Buffer.alloc(5);

  // length of the message
  buf.writeUInt32BE(1, 0);

  // id of the message
  buf.writeUInt8(3, 4);

  return buf;
}
/*
 * have: <len=0005><id=4><piece index>
 * len = 4 bytes, id = 1 byte, pieceIndex = 4 bytes
 * The have message is fixed length. The payload is the zero-based
 * index of a piece that has just been successfully downloaded and
 * verified via the hash.
 */
export function buildHave(payload) {
  const buf = Buffer.alloc(9);

  // length of the message
  buf.writeUInt32BE(5, 0);

  // id of the message
  buf.writeUInt8(4, 4);

  // piece index
  buf.writeUInt32BE(payload, 5);

  return buf;
}

/*
 * bitfield: <len=0001+X><id=5><bitfield>
 * The bitfield message is variable length, where X is the length of
 * the bitfield. The payload is a bitfield representing the pieces that
 * have been successfully downloaded. The high bit in the first byte
 * corresponds to piece index 0. Bits that are cleared indicate a
 * missing piece, and set bits indicate a valid and available piece.
 * Spare bits at the end are set to zero.
 */
export function buildBitfield(payload) {
  const buf = Buffer.alloc(payload.length + 1 + 4);

  // length of the message
  buf.writeUInt32BE(1 + payload.length, 0);

  // id of the message
  buf.writeUInt8(5, 4);

  // bitfield
  payload.copy(buf, 5);

  return buf;
}

/*
 * request: <len=0013><id=6><index><begin><length>
 * The request message is fixed length, and is used to request a block
 
 * The payload contains the following information:
 * index: integer specifying the zero-based piece index
 * begin: integer specifying the zero-based byte offset within the piece
 * length: integer specifying the requested length.
 */
export function buildRequest(payload) {
  const buf = Buffer.alloc(17);

  // length of the message
  buf.writeUInt32BE(13);

  // id of the message
  buf.writeUInt8(6, 4);

  // piece index
  buf.writeUInt32BE(payload.index, 5);

  // begin index offset
  buf.writeUInt32BE(payload.begin, 9);

  // requested length
  buf.writeUInt32BE(payload.length, 13);

  return buf;
}

/*
 * piece: <len=0009+X><id=7><index><begin><block>
 * The piece message is variable length, where X is the length of the block. 

 * The payload contains the following information:
 * index: integer specifying the zero-based piece index
 * begin: integer specifying the zero-based byte offset within the piece
 * block: block of data, which is a subset of the piece specified by index.
 */
export function buildPiece(payload) {
  const buf = Buffer.alloc(13 + payload.block.length);

  // length of the message
  buf.writeUInt32BE(9 + payload.block.length, 0);

  // id of the index
  buf.writeUInt8(7, 4);

  // piece index
  buf.writeUInt32BE(payload.index, 5);

  // begin index offset
  buf.writeUInt32BE(payload.begin, 9);

  // block
  payload.block.copy(buf, 13);

  return buf;
}

/*
 * cancel: <len=0013><id=8><index><begin><length>
 * The cancel message is fixed length, and is used to cancel block requests.
 * The payload is identical to that of the "request" message.
 */
export function buildCancel() {
  const buf = Buffer.alloc(17);

  // length of the message
  buf.writeUInt32BE(13, 0);

  // id of the message
  buf.writeUInt32BE(8, 4);

  // piece index
  buf.writeUInt32BE(payload.index, 5);

  // begin index offset
  buf.writeUInt32BE(payload.begin, 9);

  // length
  buf.writeUInt32BE(payload.length, 13);

  return buf;
}

/*
 * port: <len=0003><id=9><listen-port>
 * The port message is sent by newer versions of the Mainline that implements
 * a DHT tracker. The listen port is the port this peer's DHT node is listening on.
 */
export function buildPort(payload) {
  const buf = Buffer.alloc(7);

  // length of the message
  buf.writeUInt32BE(3, 0);

  // id of the message
  buf.writeUInt32BE(9, 4);

  // listen-port
  buf.writeUInt16BE(payload, 5);

  return buf;
}

export function parse(msg) {
  const size = msg.readInt32BE(0);
  const id = msg.length > 4 ? msg.readInt8(4) : null;
  let payload = msg.length > 5 ? msg.slice(5) : null;

  if (id === 6 || id === 7 || id === 8) {
    const rest = payload.slice(8);
    payload = {
      index: payload.readInt32BE(0),
      begin: payload.readInt32BE(4),
    };
    payload[id === 7 ? "block" : "length"] = rest;
  }

  return { size, id, payload };
}
