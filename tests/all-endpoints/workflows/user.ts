import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

export async function runUserWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const countries =
    runner.getResponse("country.getAllCountries") ??
    (await runner.loadOrFetch("country.getAllCountries", {}));

  const countryId = runner.requireId(
    "countryId",
    runner.resolveId(countries, ["countryId", "_id", "id"], "WARERA_COUNTRY_ID"),
    "WARERA_COUNTRY_ID"
  );

  ids.countryId = countryId;

  await runner.loadOrFetch("country.getCountryById", { countryId });
  await runner.loadOrFetch("government.getByCountryId", { countryId });

  const usersByCountry = await runner.loadOrFetch("user.getUsersByCountry", {
    countryId,
    limit: runner.sampleSize,
  });

  const userId = runner.requireId(
    "userId",
    runner.resolveId(usersByCountry, ["userId", "_id", "id"], "WARERA_USER_ID"),
    "WARERA_USER_ID"
  );

  ids.userId = userId;

  const countryUserIds = runner.extractTopLevelItemIds(
    usersByCountry,
    ["userId", "_id", "id"],
    runner.sampleSize
  );

  for (const sampledUserId of countryUserIds) {
    await runner.loadOrFetch("user.getUserLite", { userId: sampledUserId }, true);
  }

  if (countryUserIds.length === 0) {
    await runner.loadOrFetch("user.getUserLite", { userId });
  }

  await runner.loadOrFetch("worker.getTotalWorkersCount", { userId });
}
