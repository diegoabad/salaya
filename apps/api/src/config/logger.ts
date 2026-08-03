import pino from "pino";
import { getEnv } from "./env";

let cached: pino.Logger | null = null;

export function getLogger() {
  if (!cached) {
    const env = getEnv();
    cached = pino({
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    });
  }
  return cached;
}
