export type MuMemberGetByMuInput = {
	muId: string;
};

export type MuMemberListItem = {
	_id: string;
	mu: string;
	user: string;
	totalDamagesCount: number;
	monthlyDamagesCount: number;
	weeklyDamagesCount: number;
	totalHelpCount: number;
	monthlyHelpCount: number;
	weeklyHelpCount: number;
	createdAt: string;
	updatedAt: string;
	__v: number;
};

export type MuMemberCustomEndpoints = {
	"muMember.getByMu": {
		input: MuMemberGetByMuInput;
		output: MuMemberListItem[];
	};
};
