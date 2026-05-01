export type GameStatGetEquipmentAvgByCodeInput = {
	itemCode: string;
};

export type GameStatCustomEndpoints = {
	"gameStat.getEquipmentAvgByCode": {
		input: GameStatGetEquipmentAvgByCodeInput;
		output: number;
	};
};
