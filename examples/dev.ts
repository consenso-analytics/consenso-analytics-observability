import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createObservability } from "../src/index";

const observability = createObservability({
  serviceName: "analytics-test",
  environment: "development",
});

// Métrica específica da aplicação de exemplo
const queryPlansTotal = observability.createCounter({
  name: "analytics_query_plans_total",
  help: "Total de planos de consulta gerados",
  labelNames: ["status"] as const,
});

const server = createServer(async (req, res) => {
  const path = req.url ?? "/";

  // Exporta métricas
  if (path === "/metrics") {
    try {
      const metrics = await observability.registry.metrics();

      res.writeHead(200, {
        "Content-Type": observability.registry.contentType,
      });

      res.end(metrics);
    } catch {
      res.writeHead(500);
      res.end("Erro ao gerar metricas");
    }

    return;
  }

  // Simula operações com diferentes resultados
  const validRoutes = ["/simulate", "/simulate-slow", "/simulate-error"];

  if (validRoutes.includes(path)) {
    try {
      const result = await observability.trackOperation(
        "query_plan",
        async () => {
          // Simula processamento lento
          if (path === "/simulate-slow") {
            await delay(3000);
          }

          // Simula uma falha
          if (path === "/simulate-error") {
            throw new Error("Falha simulada");
          }

          return {
            message: "Plano gerado com sucesso",
          };
        },
      );

      observability.eventsTotal.inc({
        status: "success",
      });

      queryPlansTotal.inc({
        status: "completed",
      });

      res.writeHead(200, {
        "Content-Type": "application/json",
      });

      res.end(JSON.stringify(result));
    } catch {
      observability.eventsTotal.inc({
        status: "error",
      });

      queryPlansTotal.inc({
        status: "error",
      });

      res.writeHead(500, {
        "Content-Type": "application/json",
      });

      res.end(
        JSON.stringify({
          message: "Erro ao gerar plano",
        }),
      );
    }

    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(9100, "127.0.0.1", () => {
  console.log("Servidor iniciado na porta 9100");
  console.log("GET /metrics");
  console.log("GET /simulate");
  console.log("GET /simulate-slow");
  console.log("GET /simulate-error");
});
