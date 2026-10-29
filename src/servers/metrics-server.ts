import { createServer, type Server } from "node:http";
import type { Observability } from "../core/observability";

export interface MetricsServerOptions {
  port?: number;
  host?: string;
  path?: string;
}

export function startMetricsServer(
  observability: Observability,
  options: MetricsServerOptions = {},
): Server {
  const port = options.port ?? 9100;
  const host = options.host ?? "127.0.0.1";
  const path = options.path ?? "/metrics";

  const server = createServer(async (req, res) => {
    // Aceita somente GET /metrics
    if (req.method !== "GET" || req.url !== path) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    try {
      // Obtém todas as métricas do Registry
      const metrics = await observability.registry.metrics();

      res.writeHead(200, {
        "Content-Type": observability.registry.contentType,
        "Cache-Control": "no-store",
      });

      res.end(metrics);
    } catch (error) {
      console.error("Erro ao exportar metricas:", error);

      res.writeHead(500, {
        "Content-Type": "text/plain",
      });

      res.end("Erro ao exportar metricas");
    }
  });

  server.listen(port, host, () => {
    console.log(
      `[Observability] Metrics server: http://${host}:${port}${path}`,
    );
  });

  return server;
}
