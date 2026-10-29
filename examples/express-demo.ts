import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { setTimeout as delay } from "node:timers/promises";

import { createObservability } from "../src/index";
import {
  createExpressMetrics,
  metricsRoute,
} from "../src/integrations/express/index";
import { startMetricsServer } from "../src/servers/metrics-server";

// 1. Inicializa a observabilidade
const observability = createObservability({
  serviceName: "analytics-api",
  environment: "development",
});

// 2. Inicializa o Express
const app = express();

// 3. Ativa a instrumentação HTTP
app.use(createExpressMetrics(observability));

app.use(express.json());

// 4. Rota de saúde
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

// 5. Rota dinâmica
app.get(
  "/api/reports/:id",
  metricsRoute("/api/reports/:id"),
  async (req, res) => {
    await delay(150);

    res.json({
      id: req.params.id,
      status: "completed",
    });
  },
);

// 6. Simulação de operação lenta
app.get("/api/slow", metricsRoute("/api/slow"), async (_req, res) => {
  await delay(3000);

  res.json({
    message: "Operacao finalizada",
  });
});

// 7. Simulação de erro
app.get("/api/error", metricsRoute("/api/error"), (_req, _res, next) => {
  next(new Error("Erro simulado"));
});

// 8. Middleware de tratamento de erros
app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error.message);

  res.status(500).json({
    message: "Erro interno",
  });
});

// 9. Inicia a API
const apiServer = app.listen(8000, () => {
  console.log("API: http://localhost:8000");
});

// 10. Inicia o servidor de métricas
const metricsServer = startMetricsServer(observability, {
  port: 9100,
  host: "127.0.0.1",
});

// Encerramento simples para o ambiente de desenvolvimento
function shutdown() {
  apiServer.close();
  metricsServer.close();
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
