// AES-256-GCM at-rest encryption for OAuth refresh tokens.
// Key comes from TOKEN_ENC_KEY (base64-encoded 32 bytes).

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function getKey() {
  const b64 = process.env.TOKEN_ENC_KEY;
  if (!b64) throw new Error('TOKEN_ENC_KEY is not set');
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must decode to 32 bytes');
  return key;
}

export function encrypt(plaintext) {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct, iv, tag };
}

export function decrypt({ ct, iv, tag }) {
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  const pt = Buffer.concat([decipher.update(Buffer.from(ct)), decipher.final()]);
  return pt.toString('utf8');
}
