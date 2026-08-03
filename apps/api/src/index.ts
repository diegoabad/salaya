import { createApp } from "./app";
import { getEnv } from "./config/env";
import { getLogger } from "./config/logger";
import { attachRealtime } from "./realtime/io";
import { tickNotifications } from "./services/notifications";
import { closeDb } from "@repo/db";
import { createServer } from "node:http";

const env = getEnv();
const logger = getLogger();
const app = createApp();
const server = createServer(app);

attachRealtime(server);

server.listen(env.PORT, () => {
  logger.info(`API en http://localhost:${env.PORT}`);
  if (env.NOTIFICATIONS_POLL_MS > 0) {
    logger.info(
      { ms: env.NOTIFICATIONS_POLL_MS },
      "Notification outbox poll activo",
    );
    setInterval(() => {
      void tickNotifications({ limit: 20, hoursAhead: 24 }).catch((err) => {
        logger.warn({ err }, "notification poll failed");
      });
    }, env.NOTIFICATIONS_POLL_MS);
  }
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await closeDb();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
