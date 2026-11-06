import type { Observability } from "../../core/observability";

export type GraphqlOperationType = "query" | "mutation" | "subscription";

// O graphql() devolve erros no corpo em vez de lançar exceção
function hasGraphqlErrors(result: unknown): boolean {
  if (typeof result !== "object" || result === null || !("errors" in result)) {
    return false;
  }

  if (!Array.isArray(result.errors) || result.errors.length === 0) {
    return false;
  }

  return result.errors.every(
    (error) =>
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string",
  );
}

export function createGraphqlMetrics(observability: Observability) {
  // Total de operações GraphQL
  const operationsTotal = observability.createCounter({
    name: "app_graphql_operations_total",
    help: "Total de operacoes GraphQL executadas",
    labelNames: ["operation_type", "operation_name", "status"] as const,
  });

  // Tempo das operações GraphQL
  const operationDuration = observability.createHistogram({
    name: "app_graphql_operation_duration_seconds",
    help: "Duracao das operacoes GraphQL em segundos",
    labelNames: ["operation_type", "operation_name", "status"] as const,
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // Quantas operações GraphQL estão em andamento
  const operationsInProgress = observability.createGauge({
    name: "app_graphql_operations_in_progress",
    help: "Operacoes GraphQL em andamento",
    labelNames: ["operation_type", "operation_name"] as const,
  });

  // Instrumentação reutilizável de uma operação
  async function observe<T>(
    operationType: GraphqlOperationType,
    operationName: string | undefined,
    execute: () => Promise<T>,
  ): Promise<T> {
    const labels = {
      operation_type: operationType,
      operation_name: operationName?.trim() || "anonymous",
    };

    const inProgress = operationsInProgress.labels(labels);

    // Marca o início da operação
    inProgress.inc();

    const startedAt = process.hrtime.bigint();

    let status: "success" | "error" = "success";

    try {
      const result = await execute();

      if (hasGraphqlErrors(result)) {
        status = "error";
      }

      return result;
    } catch (error) {
      status = "error";

      // Preserva o erro original
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
