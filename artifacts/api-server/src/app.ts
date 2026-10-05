import express, { type Express } from "express";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "8kb" }));

app.use("/api", router);

// A built frontend can be served by the same loopback API when running locally.
if (!process.env.REPL_ID) {
  const webRoot = path.resolve(import.meta.dirname, "../../reposhield/dist/public");
  app.use(express.static(webRoot));
  app.get("/{*splat}", (_req, res) => { res.sendFile(path.join(webRoot, "index.html")); });
}
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Never serialize raw errors: filesystem errors can contain sensitive paths.
  res.status(500).json({ error: "Request failed safely. Please retry or check your local setup." });
});

export default app;
