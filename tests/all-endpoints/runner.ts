import { promises as fs } from "node:fs";
import path from "node:path";

import { createAPIClient } from "../../src/trpc-client";
import type { JsonValue, OperationKey } from "./types";

export class EndpointRunner {
  readonly responses: Record<string, JsonValue> = {};

  private readonly trpc = createAPIClient({
    url: process.env.WARERA_API_URL ?? "https://api2.warera.io/trpc",
    apiKey: process.env.WARERA_API_KEY,
  });

  constructor(
    private readonly outputsRoot: string,
    private readonly outputBackupsRoot: string,
    readonly sampleSize: number
  ) {}

  async backupAndResetOutputs(): Promise<string | undefined> {
    try {
      await fs.access(this.outputsRoot);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        await fs.mkdir(this.outputsRoot, { recursive: true });
        return undefined;
      }
      throw error;
    }

    await fs.mkdir(this.outputBackupsRoot, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[.:]/g, "-");
    const backupPath = path.join(this.outputBackupsRoot, `outputs-${timestamp}`);

    await fs.cp(this.outputsRoot, backupPath, { recursive: true });
    await fs.rm(this.outputsRoot, { recursive: true, force: true });
    await fs.mkdir(this.outputsRoot, { recursive: true });

    return backupPath;
  }

  getResponse(operationKey: OperationKey): JsonValue | undefined {
    return this.responses[operationKey];
  }

  async loadOrFetch(
    operationKey: OperationKey,
    input?: Record<string, unknown>,
    forceFetch?: boolean
  ): Promise<JsonValue> {
    const outputPath = this.getOutputPath(operationKey);
    if (!forceFetch) {
      const cached = await this.readJsonIfExists(outputPath);
      if (cached !== undefined) {
        this.responses[operationKey] = cached;
        return cached;
      }
    }

    const result = await this.callProcedure(operationKey, input);
    this.responses[operationKey] = result;
    await this.writeJson(outputPath, result);
    return result;
  }

  resolveId(
    source: JsonValue | undefined,
    keys: string[],
    envKey: string
  ): string | undefined {
    return (
      this.findFirstString(source, { keys, matchSuffixId: true }) ??
      (process.env[envKey] ? String(process.env[envKey]) : undefined)
    );
  }

  requireId(label: string, id: string | undefined, envKey: string): string {
    if (!id) {
      throw new Error(`Missing ${label}. Provide cache data or set ${envKey}.`);
    }
    return id;
  }

  findFirstKeyString(source: JsonValue | undefined, keyName: string): string | undefined {
    if (!source || typeof source !== "object") return undefined;

    try {
      const obj = source as { items?: unknown };
      if (Array.isArray(obj.items) && obj.items.length > 0) {
        const first = obj.items[0];
        if (
          first &&
          typeof first === "object" &&
          !Array.isArray(first) &&
          typeof (first as Record<string, unknown>)[keyName] === "string"
        ) {
          return (first as Record<string, unknown>)[keyName] as string;
        }
      }
    } catch {
      return undefined;
    }

    return undefined;
  }

  extractTopLevelItemIds(
    source: JsonValue | undefined,
    keys: string[],
    limit = this.sampleSize
  ): string[] {
    if (!source || typeof source !== "object") {
      return [];
    }

    const obj = source as { items?: unknown };
    if (!Array.isArray(obj.items)) {
      return [];
    }

    const result: string[] = [];
    for (const item of obj.items) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const record = item as Record<string, unknown>;
      for (const key of keys) {
        const value = record[key];
        if (typeof value === "string") {
          result.push(value);
          break;
        }
      }
      if (result.length >= limit) {
        break;
      }
    }

    return [...new Set(result)].slice(0, limit);
  }

  resolveCompanyIdFromCache(): string | undefined {
    const cached = this.responses["company.getCompanies"];
    return (
      this.resolveId(cached, ["companyId", "_id", "id"], "WARERA_COMPANY_ID") ??
      this.findFirstArrayItemId(cached, ["companyId", "_id", "id"]) ??
      this.findFirstArrayString(cached)
    );
  }

  finalItemCodeFromEnvOrCache(
    itemCode: string | undefined,
    envValue: string | undefined
  ): string | undefined {
    return itemCode ?? (envValue ? String(envValue) : undefined);
  }

  private getOutputPath(operationKey: OperationKey): string {
    const [group, name] = operationKey.split(".");
    return path.join(this.outputsRoot, group, `${name}.json`);
  }

  private async readJsonIfExists(filePath: string): Promise<JsonValue | undefined> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      if (!content.trim()) {
        return undefined;
      }
      return JSON.parse(content) as JsonValue;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        return undefined;
      }
      throw error;
    }
  }

  private async writeJson(filePath: string, data: JsonValue): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  }

  private async callProcedure(
    operationKey: OperationKey,
    input: Record<string, unknown> | undefined
  ): Promise<JsonValue> {
    const [group, name] = operationKey.split(".");
    const caller = (this.trpc as Record<
      string,
      Record<string, (payload: unknown) => Promise<JsonValue>>
    >)[group];
    if (!caller || !caller[name]) {
      throw new Error(`Unknown operation: ${operationKey}`);
    }
    return caller[name](input ?? {});
  }

  private findFirstString(
    value: unknown,
    options: { keys?: string[]; matchSuffixId?: boolean } = {}
  ): string | undefined {
    const { keys = [], matchSuffixId = false } = options;
    const visited = new Set<unknown>();
    const stack: unknown[] = [value];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== "object") {
        continue;
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      if (Array.isArray(current)) {
        for (const item of current) {
          stack.push(item);
        }
        continue;
      }

      for (const [key, val] of Object.entries(current)) {
        if (typeof val === "string") {
          if (keys.includes(key)) {
            return val;
          }
          if (matchSuffixId && key.toLowerCase().endsWith("id")) {
            return val;
          }
        }
        if (typeof val === "object" && val !== null) {
          stack.push(val);
        }
      }
    }

    return undefined;
  }

  private findFirstArrayItemId(
    source: JsonValue | undefined,
    keys: string[]
  ): string | undefined {
    if (!source || typeof source !== "object") {
      return undefined;
    }

    const stack: unknown[] = [source];
    const visited = new Set<unknown>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== "object") {
        continue;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (Array.isArray(current)) {
        for (const item of current) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            for (const key of keys) {
              const value = (item as Record<string, unknown>)[key];
              if (typeof value === "string") {
                return value;
              }
            }
          }
          stack.push(item);
        }
        continue;
      }

      for (const value of Object.values(current)) {
        if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }

    return undefined;
  }

  private findFirstArrayString(source: JsonValue | undefined): string | undefined {
    if (!source || typeof source !== "object") {
      return undefined;
    }

    const stack: unknown[] = [source];
    const visited = new Set<unknown>();

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current !== "object") {
        continue;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);

      if (Array.isArray(current)) {
        for (const item of current) {
          if (typeof item === "string") {
            return item;
          }
          if (item && typeof item === "object") {
            stack.push(item);
          }
        }
        continue;
      }

      for (const value of Object.values(current)) {
        if (value && typeof value === "object") {
          stack.push(value);
        }
      }
    }

    return undefined;
  }
}
