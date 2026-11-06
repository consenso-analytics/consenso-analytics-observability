import { setTimeout as delay } from "node:timers/promises";
import { buildSchema, graphql, type ExecutionResult } from "graphql";

import { createObservability } from "../src/index";
import { createGraphqlMetrics } from "../src/integrations/graphql";
import { startMetricsServer } from "../src/servers/metrics-server";

// 1. Inicializa o SDK
const observability = createObservability({
  serviceName: "analytics-graphql-service",
  environment: "development",
});

// 2. Inicializa as métricas GraphQL
const graphqlMetrics = createGraphqlMetrics(observability);

// 3. Disponibiliza o endpoint /metrics
startMetricsServer(observability, {
  port: 9100,
  host: "127.0.0.1",
});

const schema = buildSchema(`
  type Query {
    report(id: ID!): String
    slow: String
  }

  type Mutation {
    fail: String
  }
`);

const rootValue = {
  report: async ({ id }: { id: string }) => {
    await delay(100);
    return `relatorio-${id}`;
  },
  slow: async () => {
    await delay(2000);
    return "ok";
  },
  fail: async () => {
    throw new Error("Erro simulado no resolver");
  },
};

function describe(result: PromiseSettledResult<ExecutionResult>) {
  if (result.status === "rejected") {
    return "rejected";
  }

  if (result.value.errors?.length) {
    return "graphql_error";
  }

  return "success";
}

// 4. Simula operações com diferentes resultados
async function runTests() {
  const results = await Promise.allSettled([
    graphqlMetrics.observe("query", "GetReport", () =>
      graphql({
        schema,
        source: "query GetReport($id: ID!) { report(id: $id) }",
        rootValue,
        variableValues: { id: "1" },
      }),
    ),

    graphqlMetrics.observe("query", "SlowReport", () =>
      graphql({
        schema,
        source: "query SlowReport { slow }",
        rootValue,
      }),
    ),

    graphqlMetrics.observe("mutation", "Fail", () =>
      graphql({
        schema,
        source: "mutation Fail { fail }",
        rootValue,
      }),
    ),
  ]);

  console.log("Resultado das operações:");

  results.forEach((result, index) => {
    console.log(`Operação ${index + 1}: ${describe(result)}`);
  });

  console.log("Métricas: http://localhost:9100/metrics");
}

runTests().catch(console.error);
