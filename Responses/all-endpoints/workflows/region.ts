import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

export async function runRegionWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const trpc = runner.client;

  const regionObject =
    runner.getResponse("region.getRegionsObject") ??
    (await runner.loadOrFetch("region.getRegionsObject", () => trpc.region.getRegionsObject({})));

  const regionId = runner.resolveId(
    regionObject,
    ["regionId", "_id", "id"],
    "WARERA_REGION_ID"
  );

  ids.regionId = regionId;

  const regionIds = extractRegionIds(regionObject);

  if (regionIds.length > 0) {
    await runner.loadOrFetch(
      "region.getById",
      async () => Promise.all(regionIds.map(async (id) => trpc.region.getById({ regionId: id }))),
      true
    );

    if (!ids.regionId) {
      ids.regionId = regionIds[0];
    }
  } else if (regionId) {
    await runner.loadOrFetch("region.getById", () => trpc.region.getById({ regionId }), true);
  }
}

function extractRegionIds(regionObject: unknown): string[] {
  if (!regionObject || typeof regionObject !== "object" || Array.isArray(regionObject)) {
    return [];
  }

  const ids = new Set<string>();
  for (const [key, value] of Object.entries(regionObject as Record<string, unknown>)) {
    if (typeof key === "string" && key.length > 0) {
      ids.add(key);
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      const valueId = (value as Record<string, unknown>)._id;
      if (typeof valueId === "string" && valueId.length > 0) {
        ids.add(valueId);
      }
    }
  }

  return [...ids];
}
