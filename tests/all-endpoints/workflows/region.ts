import type { EndpointRunner } from "../runner";
import type { CollectedIds } from "../types";

export async function runRegionWorkflow(
  runner: EndpointRunner,
  ids: CollectedIds
): Promise<void> {
  const regionObject =
    runner.getResponse("region.getRegionsObject") ??
    (await runner.loadOrFetch("region.getRegionsObject", {}));

  const regionId = runner.resolveId(
    regionObject,
    ["regionId", "_id", "id"],
    "WARERA_REGION_ID"
  );

  ids.regionId = regionId;

  if (regionId) {
    await runner.loadOrFetch("region.getById", { regionId });
  }
}
