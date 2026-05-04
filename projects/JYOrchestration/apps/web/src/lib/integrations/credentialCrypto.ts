import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(): Buffer {
  const raw = String(process.env.JY_INTEGRATIONS_MASTER_KEY ?? "").trim();
  if (!raw) {
    throw new Error("JY_INTEGRATIONS_MASTER_KEY 가 설정되어 있지 않습니다(32바이트 이상 엔트로피 권장).");
  }
  if (raw.length >= 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex").subarray(0, 32);
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length >= 32) return buf.subarray(0, 32);
  return scryptSync(raw, "jy-integrations-v1", 32);
}

export function encryptIntegrationSecret(plain: string): { ciphertextB64: string; ivB64: string } {
  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([enc, tag]);
  return { ciphertextB64: combined.toString("base64"), ivB64: iv.toString("base64") };
}

export function decryptIntegrationSecret(ciphertextB64: string, ivB64: string): string {
  const key = deriveKey();
  const iv = Buffer.from(ivB64, "base64");
  const combined = Buffer.from(ciphertextB64, "base64");
  const tag = combined.subarray(combined.length - TAG_LEN);
  const data = combined.subarray(0, combined.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
