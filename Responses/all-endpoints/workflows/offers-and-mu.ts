import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

export async function runOffersAndMuWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const trpc = runner.client;

  const prices =
    runner.getResponse("itemTrading.getPrices") ??
    (await runner.loadOrFetch("itemTrading.getPrices", () => trpc.itemTrading.getPrices({})));

  const itemCode = runner.resolveId(prices, ["itemCode", "code"], "WARERA_ITEM_CODE");
  ids.itemCode = itemCode;

  if (itemCode) {
    await runner.loadOrFetch("tradingOrder.getTopOrders", () =>
      trpc.tradingOrder.getTopOrders({
        itemCode,
        limit: runner.sampleSize,
      })
    );
  }

  const workOffers =
    runner.getResponse("workOffer.getWorkOffersPaginated") ??
    (await runner.loadOrFetch("workOffer.getWorkOffersPaginated", () =>
      trpc.workOffer.getWorkOffersPaginated({
        limit: runner.sampleSize,
      })
    ));

  const workOfferId = runner.resolveId(
    workOffers,
    ["workOfferId", "_id", "id"],
    "WARERA_WORK_OFFER_ID"
  );
  ids.workOfferId = workOfferId;

  if (workOfferId) {
    await runner.loadOrFetch("workOffer.getById", () => trpc.workOffer.getById({ workOfferId }));
  }

  ids.companyFromWorkOffers = runner.findFirstKeyString(workOffers, "company");

  const mus =
    runner.getResponse("mu.getManyPaginated") ??
    (await runner.loadOrFetch("mu.getManyPaginated", () =>
      trpc.mu.getManyPaginated({ limit: runner.sampleSize })
    ));

  const muId = runner.resolveId(mus, ["muId", "_id", "id"], "WARERA_MU_ID");
  ids.muId = muId;

  if (muId) {
    await runner.loadOrFetch("mu.getById", () => trpc.mu.getById({ muId }));
  }

  await runner.loadOrFetch("upgrade.getUpgradeByTypeAndEntity", () =>
    trpc.upgrade.getUpgradeByTypeAndEntity({
      upgradeType: "bunker",
      regionId: ids.regionId,
      companyId: ids.companyId,
      muId,
    })
  );

  await runner.loadOrFetch("search.searchAnything", () =>
    trpc.search.searchAnything({
      searchText: process.env.WARERA_SEARCH_TEXT ?? "war",
    })
  );
}
