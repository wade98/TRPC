import { allOperations } from "../config";
import type { EndpointRunner } from "../runner";
import type { CollectedIds, OperationKey } from "../types";

export async function runFallbackWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const finalRegionId = ids.regionId ?? process.env.WARERA_REGION_ID;
  const finalCompanyId = ids.companyId ?? process.env.WARERA_COMPANY_ID;
  const finalMuId = ids.muId ?? process.env.WARERA_MU_ID;
  const finalBattleId = ids.battleId ?? process.env.WARERA_BATTLE_ID;
  const finalRoundId =
    (process.env.WARERA_ROUND_ID as string | undefined) ??
    ids.roundId ??
    runner.resolveId(
      runner.getResponse("battle.getLiveBattleData"),
      ["roundId", "_id", "id"],
      "WARERA_ROUND_ID"
    );
  const finalWorkOfferId = ids.workOfferId ?? process.env.WARERA_WORK_OFFER_ID;
  const finalArticleId = ids.articleId ?? process.env.WARERA_ARTICLE_ID;
  const finalItemCode = runner.finalItemCodeFromEnvOrCache(
    ids.itemCode,
    process.env.WARERA_ITEM_CODE
  );
  const finalCompanyIdResolved = finalCompanyId ?? runner.resolveCompanyIdFromCache();

  const getInputForOperation = (
    op: OperationKey
  ): Record<string, unknown> | undefined => {
    switch (op) {
      case "company.getById":
        if (!finalCompanyIdResolved) {
          return undefined;
        }
        return { companyId: finalCompanyIdResolved };
      case "company.getCompanies":
        return {};
      case "country.getCountryById":
        return { countryId: ids.countryId };
      case "country.getAllCountries":
        return {};
      case "event.getEventsPaginated":
        return { limit: runner.sampleSize };
      case "government.getByCountryId":
        return { countryId: ids.countryId };
      case "region.getById":
        return {
          regionId: runner.requireId("regionId", finalRegionId, "WARERA_REGION_ID"),
        };
      case "region.getRegionsObject":
        return {};
      case "battle.getById":
      case "battle.getLiveBattleData":
        return {
          battleId: runner.requireId("battleId", finalBattleId, "WARERA_BATTLE_ID"),
        };
      case "battle.getBattles":
        return { limit: runner.sampleSize };
      case "round.getById":
      case "round.getLastHits":
        return {
          roundId: runner.requireId("roundId", finalRoundId, "WARERA_ROUND_ID"),
        };
      case "battleRanking.getRanking":
        return {
          battleId: finalBattleId,
          roundId: finalRoundId,
          dataType: "damage",
          type: "country",
          side: "attacker",
        };
      case "itemTrading.getPrices":
        return {};
      case "tradingOrder.getTopOrders":
        return { itemCode: finalItemCode, limit: runner.sampleSize };
      case "workOffer.getById":
        return {
          workOfferId: runner.requireId(
            "workOfferId",
            finalWorkOfferId,
            "WARERA_WORK_OFFER_ID"
          ),
        };
      case "workOffer.getWorkOfferByCompanyId": {
        const cid = ids.companyFromWorkOffers ?? finalCompanyIdResolved;
        if (!cid) {
          return undefined;
        }
        return { companyId: cid };
      }
      case "workOffer.getWorkOffersPaginated":
        return { limit: runner.sampleSize };
      case "ranking.getRanking":
        return { rankingType: "countryDamages" };
      case "search.searchAnything":
        return { searchText: process.env.WARERA_SEARCH_TEXT ?? "war" };
      case "gameConfig.getDates":
      case "gameConfig.getGameConfig":
        return {};
      case "user.getUserLite":
        return { userId: ids.userId };
      case "user.getUsersByCountry":
        return { countryId: ids.countryId, limit: runner.sampleSize };
      case "article.getArticleById":
      case "article.getArticleLiteById":
        return {
          articleId: runner.requireId(
            "articleId",
            finalArticleId,
            "WARERA_ARTICLE_ID"
          ),
        };
      case "article.getArticlesPaginated":
        return { type: "last", limit: runner.sampleSize };
      case "mu.getById":
        return { muId: runner.requireId("muId", finalMuId, "WARERA_MU_ID") };
      case "mu.getManyPaginated":
      case "transaction.getPaginatedTransactions":
        return { limit: runner.sampleSize };
      case "upgrade.getUpgradeByTypeAndEntity":
        return {
          upgradeType: "bunker",
          regionId: finalRegionId,
          companyId: finalCompanyIdResolved,
          muId: finalMuId,
        };
      case "worker.getWorkers":
        return finalCompanyIdResolved
          ? { companyId: finalCompanyIdResolved }
          : { userId: ids.userId };
      case "worker.getTotalWorkersCount":
        return { userId: ids.userId };
      default:
        return {};
    }
  };

  for (const op of allOperations) {
    const input = getInputForOperation(op);
    if (!input) {
      continue;
    }
    await runner.loadOrFetchByOperation(op, input);
  }
}
