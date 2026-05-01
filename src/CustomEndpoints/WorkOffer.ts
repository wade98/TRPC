export type WorkOfferGetWageStatsInput = {
	energy: number;
	production: number;
	citizenship: string;
};

export type WorkOfferWageRange = {
	min: number;
	max: number;
	average: number;
};

export type WorkOfferWageStatsOffer = {
	_id: string;
	company: string;
	user: string;
	region: string;
	quantity: number;
	initialQuantity: number;
	wage: number;
	wageAfterTax: number;
	minEnergy?: number;
	minProduction?: number;
	text?: string;
	createdAt: string;
	updatedAt: string;
	__v: number;
};

export type WorkOfferGetWageStatsResponse = {
	allowedRange: WorkOfferWageRange;
	topOffer: number;
	topEligibleOffer: number;
	topEligibleOffers: WorkOfferWageStatsOffer[];
};

export type WorkOfferCustomEndpoints = {
	"workOffer.getWageStats": {
		input: WorkOfferGetWageStatsInput;
		output: WorkOfferGetWageStatsResponse;
	};
};
