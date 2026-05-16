import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type AccountCredentialPayload = {
  accountId: string;
  password: string;
  note: string | null;
};

export function encryptAccountCredentialPayload(
  payload: AccountCredentialPayload,
) {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptAccountCredentialPayload(
  encryptedPayload: string,
): AccountCredentialPayload {
  const [version, ivValue, authTagValue, encryptedValue] =
    encryptedPayload.split(".");

  if (version !== "v1" || !ivValue || !authTagValue || !encryptedValue) {
    throw new Error("계정 전달 정보 형식이 올바르지 않습니다.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivValue, "base64url"),
    { authTagLength: AUTH_TAG_LENGTH },
  );
  decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]);
  const parsed = JSON.parse(
    decrypted.toString("utf8"),
  ) as AccountCredentialPayload;

  return {
    accountId: String(parsed.accountId ?? ""),
    password: String(parsed.password ?? ""),
    note: parsed.note ? String(parsed.note) : null,
  };
}

function getEncryptionKey() {
  const rawSecret = process.env.GGITEM_ACCOUNT_CREDENTIAL_SECRET?.trim();

  if (!rawSecret) {
    throw new Error("GGITEM_ACCOUNT_CREDENTIAL_SECRET 환경변수가 필요합니다.");
  }

  if (/^[a-f0-9]{64}$/i.test(rawSecret)) {
    return Buffer.from(rawSecret, "hex");
  }

  return createHash("sha256").update(rawSecret).digest();
}
