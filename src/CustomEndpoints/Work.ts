export type WorkGetStatsByUserIdInput = {
	userId: string;
	days: number;
	timezone: string;
};

export type WorkGetStatsByCompanyInput = {
	companyId: string;
	days: number;
	timezone: string;
};

export type WorkGetStatsByWorkerAndCompanyInput = {
	workerId: string;
	companyId: string;
	days: number;
	timezone: string;
};

export type WorkStatsItem = {
	dailyDate: string;
	total: number;
	wage: number;
	employeeProd: number;
	selfWork: number;
	automatedEngine: number;
};

export type WorkCustomEndpoints = {
	"work.getStatsByUserId": {
		input: WorkGetStatsByUserIdInput;
		output: WorkStatsItem[];
	};
	"work.getStatsByCompany": {
		input: WorkGetStatsByCompanyInput;
		output: WorkStatsItem[];
	};
	"work.getStatsByWorkerAndCompany": {
		input: WorkGetStatsByWorkerAndCompanyInput;
		output: WorkStatsItem[];
	};
};
