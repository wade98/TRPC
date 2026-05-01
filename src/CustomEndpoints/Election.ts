export type ElectionGetElectionsInput = {
	countryId?: string;
	limit?: number;
	cursor?: string;
	direction?: "forward" | "backward";
};

export type ElectionCandidate = {
	user: string;
	voteCount: number;
	article?: string;
	party?: string;
	isElected?: boolean;
};

export type ElectionListItem = {
	_id: string;
	country: string;
	electedCandidates: string[];
	isActive: boolean;
	type: string;
	candidates: ElectionCandidate[];
	votesStartAt: string;
	votesEndAt: string;
	votesCount: number;
	electedCount: number;
	createdAt: string;
	status: string;
	votes: Record<string, number>;
	__v: number;
};

export type ElectionGetElectionsResponse = {
	items: ElectionListItem[];
	nextCursor?: string;
};

export type ElectionCustomEndpoints = {
	"election.getElections": {
		input: ElectionGetElectionsInput;
		output: ElectionGetElectionsResponse;
	};
};
