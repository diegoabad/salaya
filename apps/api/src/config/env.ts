import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";

config({ path: resolve(process.cwd(), "../../.env") });
config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  INTERNAL_API_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  /** Clave para cifrar tokens MP (si falta, se deriva de SESSION_SECRET) */
  TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),
  /** Access token de la app / prueba MP (fallback si el tenant no conectó) */
  MP_ACCESS_TOKEN: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  /** OAuth app (marketplace — cuenta del estudio) */
  MP_CLIENT_ID: z.string().optional(),
  MP_CLIENT_SECRET: z.string().optional(),
  /** Default: {API_PUBLIC_URL}/mp/oauth/callback */
  MP_OAUTH_REDIRECT_URI: z.string().optional(),
  /** true = no llama a MP; preferencias mock + simulate-pay */
  MP_MOCK: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  /** Comisión % SalaYa sobre señas marketplace (Checkout Pro → marketplace_fee) */
  MP_MARKETPLACE_FEE_PERCENT: z.coerce.number().min(0).max(50).default(0),
  APP_URL: z.string().default("http://localhost:3000"),
  API_PUBLIC_URL: z.string().optional(),
  /** Email: mock (default) | resend */
  EMAIL_MOCK: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  /** Alias Wally: si viene, se usa como remitente */
  RESEND_FROM: z.string().optional(),
  RESEND_REPLY_TO: z.string().optional(),
  /** Intervalo del worker outbox en ms (0 = solo tick manual) */
  NOTIFICATIONS_POLL_MS: z.coerce.number().int().min(0).default(0),
});

export type Env = z.infer<typeof envSchema> & {
  mpMock: boolean;
  emailMock: boolean;
  apiPublicUrl: string;
  tokenKeySource: string;
  emailFrom: string;
  emailReplyTo?: string;
};

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) {
    const raw = envSchema.parse(process.env);
    const mpMock =
      raw.MP_MOCK ??
      (raw.NODE_ENV !== "production" || !raw.MP_ACCESS_TOKEN);
    const emailMock =
      raw.EMAIL_MOCK ??
      (raw.NODE_ENV !== "production" || !raw.RESEND_API_KEY);
    cached = {
      ...raw,
      mpMock,
      emailMock,
      apiPublicUrl:
        raw.API_PUBLIC_URL ?? `http://127.0.0.1:${raw.PORT}`,
      tokenKeySource: raw.TOKEN_ENCRYPTION_KEY ?? raw.SESSION_SECRET,
      emailFrom:
        raw.RESEND_FROM?.trim() ||
        raw.EMAIL_FROM?.trim() ||
        "SalaYa <noreply@salaya.local>",
      emailReplyTo: raw.RESEND_REPLY_TO?.trim() || undefined,
    };
  }
  return cached;
}
