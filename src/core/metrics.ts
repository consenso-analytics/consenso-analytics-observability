import * as prom from "@prometheus-io/client";

export function createMetrics(registry: prom.Registry) {
  // Total de eventos processados
  const eventsTotal = new prom.Counter({
    name: "app_events_total",
    help: "Total de eventos processados",
    labelNames: ["status"] as const,
    registers: [registry],
  });

  // Total de operações executadas
  const operationsTotal = new prom.Counter({
    name: "app_operations_total",
    help: "Total de operacoes executadas",
    labelNames: ["operation", "status"] as const,
    registers: [registry],
  });

  // Tempo de execução das operações
  const operationDuration = new prom.Histogram({
    name: "app_operation_duration_seconds",
    help: "Duracao das operacoes em segundos",
    labelNames: ["operation", "status"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
    registers: [registry],
  });

  // Quantidade de operações em andamento
  const operationsInProgress = new prom.Gauge({
    name: "app_operations_in_progress",
    help: "Quantidade de operacoes em andamento",
    labelNames: ["operation"] as const,
    registers: [registry],
  });

  return {
    eventsTotal,
    operationsTotal,
    operationDuration,
    operationsInProgress,
  };
}
