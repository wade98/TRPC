import { operationOrder } from "../config";
import type { EndpointRunner } from "../runner";

export async function runWarmup(runner: EndpointRunner): Promise<void> {
  for (const op of operationOrder) {
    if (runner.getResponse(op)) {
      continue;
    }

    if (op === "search.searchAnything") {
      await runner.loadOrFetch(op, {
        searchText: process.env.WARERA_SEARCH_TEXT ?? "war",
      });
      continue;
    }

    if (op === "ranking.getRanking") {
      await runner.loadOrFetch(op, { rankingType: "countryDamages" });
      continue;
    }

    if (op === "article.getArticlesPaginated") {
      await runner.loadOrFetch(op, {
        type: "last",
        limit: runner.sampleSize,
      });
      continue;
    }

    if (
      op === "event.getEventsPaginated" ||
      op === "battle.getBattles" ||
      op === "mu.getManyPaginated" ||
      op === "workOffer.getWorkOffersPaginated" ||
      op === "transaction.getPaginatedTransactions"
    ) {
      await runner.loadOrFetch(op, { limit: runner.sampleSize });
      continue;
    }

    await runner.loadOrFetch(op, {});
  }
}
