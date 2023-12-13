"use strict";

import crypto from "crypto";

let id = null;

export function genId() {
  if (!id) {
    id = crypto.randomBytes(20);
    Buffer.from("-MT0001").copy(id, 0);
  }

  return id;
}
