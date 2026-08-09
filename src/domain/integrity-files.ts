import { createHmac } from "node:crypto";
import path from "node:path";

export const INTEGRITY_MIME_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "audio/mpeg": [".mp3"],
  "audio/wav": [".wav"],
  "video/mp4": [".mp4"],
};

export type EvidenceValidation =
  | { valid: true; safeName: string; kind: string }
  | { valid: false; error: string };

export function validateIntegrityEvidence(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  maxBytes: number,
): EvidenceValidation {
  const safeName = path
    .basename(originalName)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 180);
  if (!safeName || !INTEGRITY_MIME_EXTENSIONS[mimeType])
    return { valid: false, error: "Tipo de arquivo não permitido." };
  if (buffer.length < 1 || buffer.length > maxBytes)
    return {
      valid: false,
      error: `O arquivo deve possuir no máximo ${Math.ceil(maxBytes / 1048576)} MB.`,
    };
  if (
    !INTEGRITY_MIME_EXTENSIONS[mimeType].includes(
      path.extname(safeName).toLowerCase(),
    )
  )
    return {
      valid: false,
      error: "A extensão não corresponde ao tipo informado.",
    };
  const signatureValid =
    (mimeType === "image/jpeg" &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff) ||
    (mimeType === "image/png" &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mimeType === "image/webp" &&
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP") ||
    (mimeType === "application/pdf" &&
      buffer.subarray(0, 5).toString() === "%PDF-") ||
    (mimeType === "text/plain" &&
      !buffer.subarray(0, Math.min(buffer.length, 1024)).includes(0)) ||
    (mimeType === "audio/mpeg" &&
      (buffer.subarray(0, 3).toString() === "ID3" ||
        (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))) ||
    (mimeType === "audio/wav" &&
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WAVE") ||
    (mimeType === "video/mp4" && buffer.subarray(4, 8).toString() === "ftyp");
  if (!signatureValid)
    return {
      valid: false,
      error: "O conteúdo do arquivo não corresponde ao formato declarado.",
    };
  const kind = mimeType.startsWith("image/")
    ? "image"
    : mimeType.startsWith("audio/")
      ? "audio"
      : mimeType.startsWith("video/")
        ? "video"
        : "document";
  return { valid: true, safeName, kind };
}

export function integrityRateLimitKey(
  secret: string,
  action: string,
  address: string,
  scope = "",
) {
  if (!secret) throw new Error("Missing server-side rate limit secret");
  return createHmac("sha256", secret)
    .update(`${action}\n${address}\n${scope}`)
    .digest("hex");
}
