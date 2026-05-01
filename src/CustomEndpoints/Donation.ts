export type DonationGetManyPaginatedInput = {
	muId?: string;
	countryId?: string;
	partyId?: string;
	limit?: number;
	cursor?: string;
	direction?: "forward" | "backward";
};

export type DonationListItem = {
	_id: string;
	userId: string;
	muId?: string | null;
	countryId?: string | null;
	partyId?: string | null;
	amount: number;
	createdAt: string;
	updatedAt: string;
	__v: number;
};

export type DonationGetManyPaginatedResponse = {
	items: DonationListItem[];
	nextCursor?: string;
};

export type DonationGetTotalDonationsInput = {
	muId?: string;
	countryId?: string;
	partyId?: string;
};

export type DonationGetTotalDonationsResponse = {
	totalAmount: number;
	donorCount: number;
};

export type DonationCustomEndpoints = {
	"donation.getManyPaginated": {
		input: DonationGetManyPaginatedInput;
		output: DonationGetManyPaginatedResponse;
	};
	"donation.getTotalDonations": {
		input: DonationGetTotalDonationsInput;
		output: DonationGetTotalDonationsResponse;
	};
};
