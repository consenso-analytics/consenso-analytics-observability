import type { Request, Response, RequestHandler } from "express";
import type { Observability } from "../../core/observability";

const ROUTE_KEY = "__observabilityRoute";

// Permite definir explicitamente um nome estático de rota
export function metricsRoute(route: string): RequestHandler {
  return (_req, res, next) => {
    res.locals[ROUTE_KEY] = route;
    next();
  };
}

// Identifica a rota sem expor parâmetros reais
function resolveRoute(req: Request, res: Response): string {
  const explicitRoute = res.locals[ROUTE_KEY];

  if (typeof explicitRoute === "string") {
    return explicitRoute;
  }

  const expressRoute = req.route?.path;

  if (typeof expressRoute === "string") {
    return expressRoute;
  }

  return "unmatched";
}

export function createExpressMetrics(
  observability: Observability,
): RequestHandler {
  // Quantidade total de requisições
  const requestsTotal = observability.createCounter({
    name: "app_http_requests_total",
    help: "Total de requisicoes HTTP",
    labelNames: ["method", "route", "status_code", "result"] as const,
  });

  // Distribuição do tempo de resposta
  const requestDuration = observability.createHistogram({
    name: "app_http_request_duration_seconds",
    help: "Duracao das requisicoes HTTP em segundos",
    labelNames: ["method", "route", "status_code", "result"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  // Requisições atualmente em processamento
  const requestsInProgress = observability.createGauge({
    name: "app_http_requests_in_progress",
    help: "Requisicoes HTTP em andamento",
    labelNames: ["method"] as const,
  });

  return (req, res, next) => {
    const method = req.method;
    const startedAt = process.hrtime.bigint();

    requestsInProgress.inc({ method });

    // Evita registrar a mesma requisição duas vezes
    let recorded = false;

    function record(result: "completed" | "aborted") {
      if (recorded) return;

      recorded = true;

      const duration = Number(process.hrtime.bigint() - startedAt) / 1e9;

      const route = resolveRoute(req, res);

      const labels = {
        method,
        route,
        // Zero representa ausência de resposta HTTP completa
        status_code: result === "aborted" ? "0" : String(res.statusCode),
        result,
      };

      requestsTotal.inc(labels);

      requestDuration.observe(labels, duration);

      requestsInProgress.dec({ method });
    }

    // Resposta concluída normalmente
    res.once("finish", () => {
      record("completed");
    });

    // Conexão encerrada antes da conclusão
    res.once("close", () => {
      record("aborted");
    });

    next();
  };
}
