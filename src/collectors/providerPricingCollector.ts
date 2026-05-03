// Provider pricing collector - loads official pricing from manual YAML overrides.
// Scraping provider pages is fragile; the YAML file is the source of truth.
// See data/manual_overrides/provider_pricing.yaml for format and update instructions.

import { importManualPricing } from "./manualImporter.js";
import { logger } from "../utils/logger.js";

export async function collectProviderPricing(): Promise<number> {
  logger.info("Loading provider pricing from manual overrides...");
  // Delegates to the manual importer; the YAML contains all provider pricing
  const count = await importManualPricing();
  logger.info(`Provider pricing load complete: ${count} models`);
  return count;
}
