export type PartyGetByIdInput = {
	partyId: string;
};

export interface PartyEthics {
	militarism: number;
	isolationism: number;
	imperialism: number;
	industrialism: number;
}

export type PartyGetByIdResponse = {
	ethics: PartyEthics;
	_id: string;
	name: string;
	description?: string;
	country: string;
	region: string;
	leader: string;
	councilMembers: string[];
	members: string[];
	createdAt: string;
	updatedAt: string;
	__v: number;
	avatarUrl?: string;
	primaryWinner?: string;
};

export type PartyCustomEndpoints = {
	"party.getById": {
		input: PartyGetByIdInput;
		output: PartyGetByIdResponse;
	};
};