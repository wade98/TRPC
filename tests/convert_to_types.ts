import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputsRoot = path.join(__dirname, "outputs");
const outputBackupsRoot = path.join(__dirname, "outputs-backups");
const repoRoot = path.resolve(outputsRoot, "..", "..");
const outputFile = path.join(outputsRoot, "Responses.d.ts");
const srcOutputFile = path.join(repoRoot, "src", "api", "Responses.d.ts");
const ignoredFiles = new Set([
	path.join(outputsRoot, "convert_to_types.ts"),
	path.join(outputsRoot, "Responses.d.ts")
]);

type OutputEntry = {
	operationKey: string;
	typeName: string;
	typeBody: string;
};

const operationSeeds: Record<string, JsonValue> = {
	"battleRanking.getRanking": {
		rankings: [
			{
				country: "",
				value: 0,
				rank: 0,
				_id: ""
			}
		]
	}
};

const operationTypeOverrides: Record<string, string> = {
	"battleRanking.getRanking": `{
  rankings: Array<{
    country: string;
    value: number;
    rank: number;
    _id: string;
  }>;
}`
};

function isIdentifier(name: string): boolean {
	return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

function formatPropertyName(name: string): string {
	return isIdentifier(name) ? name : JSON.stringify(name);
}

function looksLikeIdKey(key: string): boolean {
	return (
		/^[a-f0-9]{24}$/i.test(key) ||
		/^[a-f0-9]{32}$/i.test(key) ||
		/^[a-f0-9-]{36}$/i.test(key) ||
		/^\d+$/.test(key)
	);
}

function looksLikeDynamicIdKey(key: string): boolean {
	return (
		/^[a-f0-9]{24}$/i.test(key) ||
		/^[a-f0-9]{32}$/i.test(key) ||
		/^[a-f0-9-]{36}$/i.test(key)
	);
}

function shouldUseDynamicRecordForMergedObject(keys: string[]): boolean {
	if (keys.length < 3) {
		return false;
	}

	const dynamicIdCount = keys.filter(looksLikeDynamicIdKey).length;
	return dynamicIdCount / keys.length >= 0.8;
}

function shouldUseRecord(obj: Record<string, JsonValue>): boolean {
	const keys = Object.keys(obj);
	if (keys.length === 0) {
		return false;
	}

	const idKeyCount = keys.filter(looksLikeIdKey).length;
	if (keys.length >= 5 && idKeyCount === keys.length) {
		return true;
	}

	const invalidKeyCount = keys.filter((key) => !isIdentifier(key)).length;
	if (keys.length >= 20 && invalidKeyCount / keys.length > 0.6) {
		return true;
	}

	return false;
}

function toPascalCase(value: string): string {
	const separated = value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/[^A-Za-z0-9]+/g, " ")
		.trim();

	if (!separated) {
		return "";
	}

	return separated
		.split(/\s+/g)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join("");
}

function indent(level: number): string {
	return "  ".repeat(level);
}

function uniqueTypes(types: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const type of types) {
		if (!seen.has(type)) {
			seen.add(type);
			result.push(type);
		}
	}
	return result;
}

function toUnion(types: string[]): string {
	const unique = uniqueTypes(types);
	if (unique.length === 0) {
		return "unknown";
	}
	if (unique.includes("unknown")) {
		return "unknown";
	}
	if (unique.length === 1) {
		return unique[0];
	}
	return unique.join(" | ");
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function inferMergedObjectType(objects: Record<string, JsonValue>[], level: number): string {
	if (objects.length === 0) {
		return "{}";
	}

	const keySet = new Set<string>();
	for (const obj of objects) {
		for (const key of Object.keys(obj)) {
			keySet.add(key);
		}
	}

	const keys = Array.from(keySet).sort((a, b) => a.localeCompare(b));
	if (keys.length === 0) {
		return "{}";
	}

	if (shouldUseDynamicRecordForMergedObject(keys)) {
		const allValues = objects.flatMap((obj) => Object.values(obj));
		const valueType = inferMany(allValues, level + 1);
		return `Record<string, ${valueType}>`;
	}

	const lines = keys.map((key) => {
		const values: JsonValue[] = [];
		let seenIn = 0;
		for (const obj of objects) {
			if (Object.hasOwn(obj, key)) {
				seenIn += 1;
				values.push(obj[key]);
			}
		}

		const optional = seenIn < objects.length;
		const propName = formatPropertyName(key);
		const propType = inferMany(values, level + 1);
		return `${indent(level + 1)}${propName}${optional ? "?" : ""}: ${propType};`;
	});

	return `{
${lines.join("\n")}
${indent(level)}}`;
}

function inferMany(values: JsonValue[], level: number): string {
	if (values.length === 0) {
		return "unknown";
	}

	if (values.some((value) => value === null)) {
		return "unknown";
	}

	if (values.every((value) => isPlainObject(value))) {
		return inferMergedObjectType(values as Record<string, JsonValue>[], level);
	}

	if (values.every((value) => Array.isArray(value))) {
		const flattened = values.flatMap((value) => value as JsonValue[]);
		if (flattened.length === 0) {
			return "unknown[]";
		}
		if (flattened.every((item) => isPlainObject(item))) {
			const mergedItemType = inferMergedObjectType(flattened as Record<string, JsonValue>[], level);
			return `Array<${mergedItemType}>`;
		}
		const itemType = toUnion(flattened.map((item) => inferType(item, level + 1)));
		return `Array<${itemType}>`;
	}

	return toUnion(values.map((value) => inferType(value, level)));
}

function inferType(value: JsonValue, level: number): string {
	if (value === null) {
		return "unknown";
	}

	if (Array.isArray(value)) {
		if (value.length === 0) {
			return "unknown[]";
		}
		if (value.every((item) => isPlainObject(item))) {
			return `Array<${inferMergedObjectType(value as Record<string, JsonValue>[], level)}>`;
		}
		const itemTypes = value.map((item) => inferType(item, level + 1));
		return `Array<${toUnion(itemTypes)}>`;
	}

	switch (typeof value) {
		case "string":
			return "string";
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		case "object":
			return inferObjectType(value as Record<string, JsonValue>, level);
		default:
			return "unknown";
	}
}

function inferObjectType(obj: Record<string, JsonValue>, level: number): string {
	const entries = Object.entries(obj);
	if (entries.length === 0) {
		return "{}";
	}

	if (shouldUseRecord(obj)) {
		const union = inferMany(entries.map(([, value]) => value), level + 1);
		return `Record<string, ${union}>`;
	}

	const lines = entries.map(([key, value]) => {
		const propName = formatPropertyName(key);
		const propType = inferType(value, level + 1);
		return `${indent(level + 1)}${propName}: ${propType};`;
	});

	return `{
${lines.join("\n")}
${indent(level)}}`;
}

async function listJsonFiles(dir: string): Promise<string[]> {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (ignoredFiles.has(fullPath)) {
			continue;
		}
		if (entry.isDirectory()) {
			files.push(...(await listJsonFiles(fullPath)));
		} else if (entry.isFile() && entry.name.endsWith(".json")) {
			files.push(fullPath);
		}
	}

	return files;
}

async function readJson(filePath: string): Promise<JsonValue | undefined> {
	const content = await fs.readFile(filePath, "utf8");
	if (!content.trim()) {
		return undefined;
	}
	return JSON.parse(content) as JsonValue;
}

async function readJsonIfExists(filePath: string): Promise<JsonValue | undefined> {
	try {
		return await readJson(filePath);
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err.code === "ENOENT") {
			return undefined;
		}
		throw error;
	}
}

function isSparseValue(value: JsonValue): boolean {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return true;
		}
		return value.every((item) => isSparseValue(item));
	}

	if (value && typeof value === "object") {
		const entries = Object.values(value);
		if (entries.length === 0) {
			return true;
		}
		return entries.some((entry) => isSparseValue(entry));
	}

	return false;
}

async function getBackupPayloadsForFile(filePath: string, limit = 5): Promise<JsonValue[]> {
	const relativePath = path.relative(outputsRoot, filePath);
	if (!relativePath || relativePath.startsWith("..")) {
		return [];
	}

	let backupDirs: string[] = [];
	try {
		const entries = await fs.readdir(outputBackupsRoot, { withFileTypes: true });
		backupDirs = entries
			.filter((entry) => entry.isDirectory() && entry.name.startsWith("outputs-"))
			.map((entry) => entry.name)
			.sort((a, b) => b.localeCompare(a));
	} catch (error) {
		const err = error as NodeJS.ErrnoException;
		if (err.code === "ENOENT") {
			return [];
		}
		throw error;
	}

	const payloads: JsonValue[] = [];
	for (const dirName of backupDirs) {
		if (payloads.length >= limit) {
			break;
		}
		const backupPath = path.join(outputBackupsRoot, dirName, relativePath);
		const payload = await readJsonIfExists(backupPath);
		if (payload !== undefined) {
			payloads.push(payload);
		}
	}

	return payloads;
}

function buildTypeName(group: string, name: string): string {
	return `${toPascalCase(group)}${toPascalCase(name)}Response`;
}

async function buildEntries(files: string[]): Promise<OutputEntry[]> {
	const entries: OutputEntry[] = [];

	for (const filePath of files) {
		const relative = path.relative(outputsRoot, filePath).replace(/\\/g, "/");
		const parts = relative.split("/");
		if (parts.length < 2) {
			continue;
		}
		const group = parts[0];
		const fileName = parts[parts.length - 1];
		const name = path.basename(fileName, ".json");
		const operationKey = `${group}.${name}`;

		const payload = await readJson(filePath);
		if (payload === undefined) {
			continue;
		}

		const samplePayloads: JsonValue[] = [payload];
		if (isSparseValue(payload)) {
			const seededPayload = operationSeeds[operationKey];
			if (seededPayload) {
				samplePayloads.push(seededPayload);
			}
			const backupPayloads = await getBackupPayloadsForFile(filePath);
			samplePayloads.push(...backupPayloads);
		}

		const typeName = buildTypeName(group, name);
		const typeBody = operationTypeOverrides[operationKey] ?? inferMany(samplePayloads, 0);
		entries.push({ operationKey, typeName, typeBody });
	}

	return entries.sort((a, b) => a.operationKey.localeCompare(b.operationKey));
}

async function writeResponses(entries: OutputEntry[], targetFile: string): Promise<void> {
	const lines: string[] = [];
	lines.push("// Generated by tests/convert_to_types.ts");
	lines.push("");

	for (const entry of entries) {
		lines.push(`export type ${entry.typeName} = ${entry.typeBody};`);
		lines.push("");
	}

	lines.push("export interface Responses {");
	for (const entry of entries) {
		lines.push(`  \"${entry.operationKey}\": ${entry.typeName};`);
	}
	lines.push("}");
	lines.push("");

	await fs.writeFile(targetFile, lines.join("\n"), "utf8");
}

export async function generateResponseTypes(): Promise<number> {
	const jsonFiles = await listJsonFiles(outputsRoot);
	const entries = await buildEntries(jsonFiles);
	await Promise.all([
		writeResponses(entries, outputFile),
		writeResponses(entries, srcOutputFile)
	]);
	return entries.length;
}

async function main(): Promise<void> {
	const entriesCount = await generateResponseTypes();
	console.log(
		`Generated ${entriesCount} response types in ${outputFile} and ${srcOutputFile}`
	);
}

const invokedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isDirectExecution = invokedFilePath === __filename;

if (isDirectExecution) {
	main().catch((error) => {
		console.error("Failed to generate response types:", error);
		process.exit(1);
	});
}
