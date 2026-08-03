import { pingDb } from "@repo/db";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { getEnv } from "./config/env";
import { getLogger } from "./config/logger";
import { errorHandler } from "./middlewares/errorHandler";
import { authRouter } from "./routes/auth";
import { adicionalesRouter } from "./routes/adicionales";
import { bloqueosRouter } from "./routes/bloqueos";
import { cajaRouter } from "./routes/caja";
import { clientesRouter } from "./routes/clientes";
import { holdsRouter } from "./routes/holds";
import { mpRouter } from "./routes/mp";
import { negocioRouter } from "./routes/negocio";
import { preciosRouter } from "./routes/precios";
import { reservasRouter } from "./routes/reservas";
import { salasRouter } from "./routes/salas";
import { publicPagosRouter, webhooksRouter } from "./routes/webhooks";
import { resenasRouter } from "./routes/resenas";
import { membresiasRouter } from "./routes/membresias";
import { suscripcionRouter } from "./routes/suscripcion";
import { jobsRouter } from "./routes/jobs";
import { publicCancelRouter } from "./routes/public-cancel";
import { publicAnalyticsRouter } from "./routes/public-analytics";
import { publicReclamacionesRouter } from "./routes/public-reclamaciones";
import { publicResenasRouter } from "./routes/public-resenas";
import { uploadsRouter } from "./routes/uploads";
import { uploadsRoot } from "./services/uploads-fs";

export function createApp() {
  const env = getEnv();
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser(env.SESSION_SECRET));

  app.use(
    "/media",
    express.static(uploadsRoot(), {
      maxAge: "7d",
      fallthrough: false,
      index: false,
    }),
  );

  app.get("/health", async (_req, res) => {
    try {
      await pingDb();
      res.json({ ok: true, db: true });
    } catch (err) {
      getLogger().error({ err }, "health check failed");
      res.status(503).json({ ok: false, db: false });
    }
  });

  app.use("/auth", authRouter);
  app.use("/negocio", negocioRouter);
  app.use("/salas", salasRouter);
  app.use("/uploads", uploadsRouter);
  app.use("/reservas", reservasRouter);
  app.use("/clientes", clientesRouter);
  app.use("/caja", cajaRouter);
  app.use("/adicionales", adicionalesRouter);
  app.use("/bloqueos", bloqueosRouter);
  app.use("/precios", preciosRouter);
  app.use("/mp", mpRouter);
  app.use("/resenas", resenasRouter);
  app.use("/membresias", membresiasRouter);
  app.use("/suscripcion", suscripcionRouter);
  app.use("/internal/jobs", jobsRouter);
  app.use("/webhooks", webhooksRouter);
  app.use("/public/analytics", publicAnalyticsRouter);
  app.use("/public/reclamaciones", publicReclamacionesRouter);
  app.use("/public/resenas", publicResenasRouter);
  app.use("/public/pagos", publicPagosRouter);
  app.use("/public/reservas", publicCancelRouter);
  app.use("/public/salas/:salaId/holds", holdsRouter);

  app.use(errorHandler);
  return app;
}
