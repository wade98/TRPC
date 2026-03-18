export type {
	PartyCustomEndpoints,
	PartyEthics,
	PartyGetByIdInput,
	PartyGetByIdResponse
} from "./Party";

export type {
	CompanyCustomEndpoints,
	CompanyGetRecommendedRegionIdsByItemCodeInput, RecommendedRegion, RecommendedRegions
} from "./Company";

import type { CompanyCustomEndpoints } from "./Company";
import type { PartyCustomEndpoints } from "./Party";

export type WarEraCustomEndpoints = PartyCustomEndpoints & CompanyCustomEndpoints;