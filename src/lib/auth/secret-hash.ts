import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const SECRET_KEY_LENGTH = 64;
const scrypt = promisify(nodeScrypt);

export async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(secret, salt, SECRET_KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifySecret(secret: string, secretHash: string) {
  const [algorithm, salt, digest] = secretHash.split("$");

  if (algorithm !== "scrypt" || !salt || !digest) {
    return false;
  }

  const derived = (await scrypt(secret, salt, SECRET_KEY_LENGTH)) as Buffer;
  const stored = Buffer.from(digest, "hex");

  if (stored.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(stored, derived);
}
