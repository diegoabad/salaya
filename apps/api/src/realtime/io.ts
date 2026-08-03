import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { getEnv } from "../config/env";
import { getLogger } from "../config/logger";
import {
  listHolds,
  onHoldChange,
  tickExpiredHolds,
  type HoldPublic,
} from "../services/holds";

export type HoldsServer = Server<ClientToServerEvents, ServerToClientEvents>;

type ClientToServerEvents = {
  "sala:join": (
    payload: { salaId: string },
    ack?: (holds: HoldPublic[]) => void,
  ) => void;
  "sala:leave": (payload: { salaId: string }) => void;
};

type ServerToClientEvents = {
  "holds:snapshot": (payload: { salaId: string; holds: HoldPublic[] }) => void;
  "hold:upsert": (hold: HoldPublic) => void;
  "hold:remove": (payload: { id: string; salaId: string }) => void;
};

let io: HoldsServer | null = null;

export function getIo(): HoldsServer | null {
  return io;
}

export function attachRealtime(httpServer: HttpServer) {
  const env = getEnv();
  const logger = getLogger();

  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    socket.on("sala:join", (payload, ack) => {
      const salaId = payload?.salaId?.trim();
      if (!salaId) return;
      void socket.join(`sala:${salaId}`);
      void listHolds(salaId)
        .then((holds) => {
          socket.emit("holds:snapshot", { salaId, holds });
          ack?.(holds);
        })
        .catch(() => {
          ack?.([]);
        });
    });

    socket.on("sala:leave", (payload) => {
      const salaId = payload?.salaId?.trim();
      if (!salaId) return;
      void socket.leave(`sala:${salaId}`);
    });
  });

  onHoldChange((event, hold) => {
    const room = `sala:${hold.salaId}`;
    if (event === "upsert") {
      io?.to(room).emit("hold:upsert", hold);
    } else {
      io?.to(room).emit("hold:remove", { id: hold.id, salaId: hold.salaId });
    }
  });

  const purgeId = setInterval(() => {
    void tickExpiredHolds();
  }, 2000);

  httpServer.on("close", () => {
    clearInterval(purgeId);
  });

  logger.info("Realtime (socket.io) listo en /socket.io");
  return io;
}

export function roomBroadcastHoldUpsert(hold: HoldPublic) {
  io?.to(`sala:${hold.salaId}`).emit("hold:upsert", hold);
}

export function roomBroadcastHoldRemove(id: string, salaId: string) {
  io?.to(`sala:${salaId}`).emit("hold:remove", { id, salaId });
}
