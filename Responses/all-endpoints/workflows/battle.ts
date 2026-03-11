import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

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
    (await runner.loadOrFetch("battle.getBattles", () =>
      trpc.battle.getBattles({ limit: runner.sampleSize })
    ));

  const battleId = runner.resolveId(
    battleList,
    ["battleId", "_id", "id"],
    "WARERA_BATTLE_ID"
  );
  ids.battleId = battleId;

  const battleIds = runner.extractTopLevelItemIds(
    battleList,
    ["battleId", "_id", "id"],
    runner.sampleSize
  );

  const sampledBattleIds =
    battleIds.length > 0 ? battleIds : battleId ? [battleId] : [];

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
