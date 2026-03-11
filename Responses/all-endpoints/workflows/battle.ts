import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

const DEFAULT_HISTORICAL_REGION_ID = "6873d11494e6b3b7989a4c1a";

export async function runBattleWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const trpc = runner.client;

  await runner.loadOrFetch("ranking.getRanking", () =>
    trpc.ranking.getRanking({ rankingType: "countryDamages" })
  );
  await runner.loadOrFetch("event.getEventsPaginated", () =>
    trpc.event.getEventsPaginated({ limit: runner.sampleSize })
  );

  const battleList =
    runner.getResponse("battle.getBattles") ??
    (await runner.loadOrFetch(
      "battle.getBattles",
      () => collectAllBattles(trpc, runner.sampleSize),
      true
    ));

  const activeBattleIds = extractActiveBattleIds(battleList);
  const historicalRegionId = resolveHistoricalRegionId();
  const historicalRegionBattleIds = await collectHistoricalRegionBattleIds(
    trpc,
    historicalRegionId,
    runner.sampleSize
  );

  const battleId = runner.resolveId(
    battleList,
    ["battleId", "_id", "id"],
    "WARERA_BATTLE_ID"
  );
  ids.battleId = battleId;

  const sampledBattleIds =
    [...new Set([...activeBattleIds, ...historicalRegionBattleIds])].length > 0
      ? [...new Set([...activeBattleIds, ...historicalRegionBattleIds])]
      : battleId
      ? [battleId]
      : [];

  const sampledRoundIds = new Set<string>();

  for (const sampledBattleId of sampledBattleIds) {
    await runner.loadOrFetch(
      "battle.getById",
      () => trpc.battle.getById({ battleId: sampledBattleId }),
      true
    );
    const battleLive = await runner.loadOrFetch(
      "battle.getLiveBattleData",
      () => trpc.battle.getLiveBattleData({ battleId: sampledBattleId }),
      true
    );
    const sampledRoundId =
      runner.resolveId(battleLive, ["roundId", "_id", "id"], "WARERA_ROUND_ID") ??
      runner.resolveId(battleList, ["roundId", "_id", "id"], "WARERA_ROUND_ID");

    if (sampledRoundId) {
      sampledRoundIds.add(sampledRoundId);
    }
  }

  for (const sampledRoundId of sampledRoundIds) {
    await runner.loadOrFetch("round.getById", () => trpc.round.getById({ roundId: sampledRoundId }), true);
    await runner.loadOrFetch(
      "round.getLastHits",
      () => trpc.round.getLastHits({ roundId: sampledRoundId }),
      true
    );
    if (!ids.roundId) {
      ids.roundId = sampledRoundId;
    }
  }

  await runner.loadOrFetch("battleRanking.getRanking", () =>
    trpc.battleRanking.getRanking({
      battleId: ids.battleId,
      roundId: ids.roundId,
      dataType: "damage",
      type: "country",
      side: "attacker",
    })
  );
}

async function collectAllBattles(
  trpc: EndpointRunner["client"],
  pageSize: number
): Promise<{ items: unknown[]; nextCursor: null }> {
  const items: unknown[] = [];

  for await (const page of trpc.battle.getBattles({
    autoPaginate: true,
    limit: Math.max(1, pageSize),
  })) {
    if (Array.isArray(page.items)) {
      items.push(...page.items);
    }
  }

  return {
    items,
    nextCursor: null,
  };
}

async function collectHistoricalRegionBattleIds(
  trpc: EndpointRunner["client"],
  regionId: string,
  pageSize: number
): Promise<string[]> {
  const battleIds = new Set<string>();

  for await (const page of trpc.battle.getBattles({
    autoPaginate: true,
    limit: Math.max(1, pageSize),
    isActive: false,
    defenderRegionId: regionId,
  })) {
    for (const item of page.items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }

      const battle = item as unknown as Record<string, unknown>;
      const value = battle.battleId ?? battle._id ?? battle.id;
      if (typeof value === "string" && value.length > 0) {
        battleIds.add(value);
      }
    }
  }

  return [...battleIds];
}

function extractActiveBattleIds(battleList: unknown): string[] {
  if (!battleList || typeof battleList !== "object" || Array.isArray(battleList)) {
    return [];
  }

  const items = (battleList as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return [];
  }

  const activeBattleIds = new Set<string>();

  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const battle = item as Record<string, unknown>;
    if (battle.isActive !== true) {
      continue;
    }

    const value = battle.battleId ?? battle._id ?? battle.id;
    if (typeof value === "string" && value.length > 0) {
      activeBattleIds.add(value);
    }
  }

  return [...activeBattleIds];
}

function resolveHistoricalRegionId(): string {
  const fromEnv = process.env.WARERA_HISTORICAL_REGION_ID;
  return typeof fromEnv === "string" && fromEnv.length > 0
    ? fromEnv
    : DEFAULT_HISTORICAL_REGION_ID;
}
