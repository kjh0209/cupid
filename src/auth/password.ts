import { scrypt, randomBytes, timingSafeEqual } from "crypto";

const KEY_LEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }, (err, key) => {
      if (err) reject(err);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt);
  return { hash: derived.toString("base64"), salt: salt.toString("base64") };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const saltBuf = Buffer.from(salt, "base64");
  const expected = Buffer.from(hash, "base64");
  const derived = await scryptAsync(password, saltBuf);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
