import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica x-signature de webhooks MP.
 * Manifest: id:{dataId};request-id:{requestId};ts:{ts};
 * (omite pares faltantes). dataId en minúsculas.
 */
export function verifyMpWebhookSignature(input: {
  xSignature: string | undefined;
  xRequestId: string | undefined;
  dataId: string | undefined;
  secret: string;
}): boolean {
  if (!input.xSignature || !input.secret) return false;
  const parts = Object.fromEntries(
    input.xSignature.split(",").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, rest.join("=")];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const chunks: string[] = [];
  if (input.dataId) chunks.push(`id:${input.dataId.toLowerCase()}`);
  if (input.xRequestId) chunks.push(`request-id:${input.xRequestId}`);
  chunks.push(`ts:${ts}`);
  const manifest = `${chunks.join(";")};`;

  const expected = createHmac("sha256", input.secret)
    .update(manifest)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
