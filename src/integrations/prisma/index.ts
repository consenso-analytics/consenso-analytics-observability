import type { Observability } from "../../core/observability";

export function createPrismaMetrics(observability: Observability) {
  // Total de operações Prisma
  const operationsTotal = observability.createCounter({
    name: "app_prisma_operations_total",
    help: "Total de operacoes executadas pelo Prisma",
    labelNames: ["model", "operation", "status"] as const,
  });

  // Tempo das operações Prisma
  const operationDuration = observability.createHistogram({
    name: "app_prisma_operation_duration_seconds",
    help: "Duracao das operacoes Prisma em segundos",
    labelNames: ["model", "operation", "status"] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // Quantas operações Prisma estão em andamento
  const operationsInProgress = observability.createGauge({
    name: "app_prisma_operations_in_progress",
    help: "Operacoes Prisma em andamento",
    labelNames: ["model", "operation"] as const,
  });

  // Instrumentação reutilizável de uma operação
  async function observe<T>(
    model: string | undefined,
    operation: string,
    execute: () => Promise<T>,
  ): Promise<T> {
    const labels = {
      model: model ?? "raw",
      operation,
    };

    const inProgress = operationsInProgress.labels(labels);

    // Marca o início da operação
    inProgress.inc();

    const startedAt = process.hrtime.bigint();

    let status: "success" | "error" = "success";

    try {
      // Executa a operação original
      return await execute();
    } catch (error) {
      status = "error";

      // Preserva o erro original do Prisma
      throw error;
    } finally {
      // Converte nanossegundos para segundos
      const duration = Number(process.hrtime.bigint() - startedAt) / 1e9;

      operationsTotal.inc({
        ...labels,
        status,
      });

      operationDuration.observe(
        {
          ...labels,
          status,
        },
        duration,
      );

      // A operação terminou
      inProgress.dec();
    }
  }

  return {
    observe,
    operationsTotal,
    operationDuration,
    operationsInProgress,
  };
}
