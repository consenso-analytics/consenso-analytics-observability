import { setTimeout as delay } from "node:timers/promises";

import { createObservability } from "../src/index";
import { createPrismaMetrics } from "../src/integrations/prisma";
import { startMetricsServer } from "../src/servers/metrics-server";

// 1. Inicializa o SDK
const observability = createObservability({
  serviceName: "analytics-query-service",
  environment: "development",
});

// 2. Inicializa as métricas Prisma
const prismaMetrics = createPrismaMetrics(observability);

// 3. Disponibiliza o endpoint /metrics
startMetricsServer(observability, {
  port: 9100,
  host: "127.0.0.1",
});

// 4. Simula operações com diferentes resultados
async function runTests() {
  const results = await Promise.allSettled([
    // Consulta rápida
    prismaMetrics.observe("Report", "findMany", async () => {
      await delay(100);
      return [{ id: 1 }, { id: 2 }];
    }),

    // Consulta lenta
    prismaMetrics.observe("Report", "findMany", async () => {
      await delay(2000);
      return [{ id: 3 }];
    }),

    // Operação que falha
    prismaMetrics.observe("Report", "create", async () => {
      await delay(300);
      throw new Error("Erro simulado no banco");
    }),
  ]);

  console.log("Resultado das operações:");

  results.forEach((result, index) => {
    console.log(`Operação ${index + 1}: ${result.status}`);
  });

  console.log("Métricas: http://localhost:9100/metrics");
}

runTests().catch(console.error);
