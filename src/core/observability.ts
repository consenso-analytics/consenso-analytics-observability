import * as prom from "@prometheus-io/client";
import { createMetrics } from "./metrics";

export interface ObservabilityOptions {
  serviceName: string;
  environment?: string;
}

export function createObservability(options: ObservabilityOptions) {
  // 1. Cria um registry exclusivo
  const registry = new prom.Registry();

  // 2. Identifica o microserviço
  registry.setDefaultLabels({
    service: options.serviceName,
    environment: options.environment ?? "development",
  });

  // 3. Habilita as métricas do Node.js
  prom.collectDefaultMetrics({
    register: registry,
  });

  // 4. Cria as métricas padronizadas
  const metrics = createMetrics(registry);

  // 5. Permite criar contadores personalizados
  function createCounter<T extends string>(
    config: Omit<prom.CounterConfiguration<T>, "registers">,
  ) {
    return new prom.Counter<T>({
      ...config,
      registers: [registry],
    });
  }

  // 6. Permite criar histogramas personalizados
  function createHistogram<T extends string>(
    config: Omit<prom.HistogramConfiguration<T>, "registers">,
  ) {
    return new prom.Histogram<T>({
      ...config,
      registers: [registry],
    });
  }

  // 7. Permite criar gauges personalizados
  function createGauge<T extends string>(
    config: Omit<prom.GaugeConfiguration<T>, "registers">,
  ) {
    return new prom.Gauge<T>({
      ...config,
      registers: [registry],
    });
  }

  // 8. Instrumenta operações assíncronas
  async function trackOperation<T>(
    operation: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    const inProgress = metrics.operationsInProgress.labels({
      operation,
    });

    // Inicia a contagem de operações ativas
    inProgress.inc();

    const startedAt = process.hrtime.bigint();
    let status: "success" | "error" = "success";

    try {
      return await execute();
    } catch (error) {
      status = "error";
      throw error;
    } finally {
      const duration = Number(process.hrtime.bigint() - startedAt) / 1e9;

      metrics.operationsTotal.inc({
        operation,
        status,
      });

      metrics.operationDuration.observe({ operation, status }, duration);

      // Finaliza a contagem de operações ativas
      inProgress.dec();
    }
  }

  return {
    registry,
    ...metrics,
    createCounter,
    createHistogram,
    createGauge,
    trackOperation,
  };
}

export type Observability = ReturnType<typeof createObservability>;

export {
  createExpressMetrics,
  metricsRoute,
} from "../integrations/express/index";

export { startMetricsServer } from "../servers/metrics-server";

export { createPrismaMetrics } from "../integrations/prisma/index";
