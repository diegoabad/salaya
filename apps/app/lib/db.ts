import { createDb } from "@repo/db";

type AppDb = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as {
  __appDb?: AppDb;
  __appDbUrl?: string;
};

export function getAppDb(): AppDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  // Recrear el pool si cambió la URL (p. ej. tras editar .env.local sin reiniciar).
  if (!globalForDb.__appDb || globalForDb.__appDbUrl !== url) {
    globalForDb.__appDb = createDb(url);
    globalForDb.__appDbUrl = url;
  }
  return globalForDb.__appDb;
}
