export type CompanyGetRecommendedRegionIdsByItemCodeInput = {
	itemCode: string;
};

export interface RecommendedRegion {
	regionId: string;
	bonus: number;
	depositBonus: number;
	ethicDepositBonus: number;
	strategicBonus: number;
	ethicSpecializationBonus: number;
	taxPercent: number;
	depositEndAt?: string;
	itemCode?: string;
}

export type RecommendedRegions =
	RecommendedRegion[];

export type CompanyCustomEndpoints = {
	"company.getRecommendedRegionIdsByItemCode": {
		input: CompanyGetRecommendedRegionIdsByItemCodeInput;
		output: RecommendedRegions;
	};
};