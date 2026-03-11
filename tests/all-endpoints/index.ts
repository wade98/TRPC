import path from "node:path";
import { fileURLToPath } from "node:url";

import { generateResponseTypes } from "../convert_to_types";
import { SAMPLE_SIZE } from "./config";
import { EndpointRunner } from "./runner";
import type { CollectedIds } from "./types";
import { runArticleWorkflow } from "./workflows/article";
import { runBattleWorkflow } from "./workflows/battle";
import { runCompanyWorkflow } from "./workflows/company";
import { runFallbackWorkflow } from "./workflows/fallback";
import { runOffersAndMuWorkflow } from "./workflows/offers-and-mu";
import { runRegionWorkflow } from "./workflows/region";
import { runUserWorkflow } from "./workflows/user";
import { runWarmup } from "./workflows/warmup";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testsRoot = path.resolve(__dirname, "..");

const outputsRoot = path.join(testsRoot, "outputs");
const outputBackupsRoot = path.join(testsRoot, "outputs-backups");

const cliArgs = new Set(process.argv.slice(2));
const shouldRefreshOutputs =
  cliArgs.has("--refresh-outputs") ||
  cliArgs.has("--fresh") ||
  cliArgs.has("--rebuild-outputs");

export async function runAllEndpoints(): Promise<void> {
  const runner = new EndpointRunner(outputsRoot, outputBackupsRoot, SAMPLE_SIZE);

  if (shouldRefreshOutputs) {
    const backupPath = await runner.backupAndResetOutputs();
    if (backupPath) {
      console.log(`Backed up outputs to: ${backupPath}`);
    }
    console.log("Cleared outputs cache. Re-fetching all endpoints...");
  }

  const ids: CollectedIds = {};

  await runWarmup(runner);
  await runUserWorkflow(runner, ids);
  await runRegionWorkflow(runner, ids);
  await runCompanyWorkflow(runner, ids);
  await runBattleWorkflow(runner, ids);
  await runOffersAndMuWorkflow(runner, ids);
  await runArticleWorkflow(runner, ids);
  await runFallbackWorkflow(runner, ids);

  if (shouldRefreshOutputs) {
    await generateResponseTypes();
    console.log("Refreshed response types from newly fetched outputs.");
  }
}
