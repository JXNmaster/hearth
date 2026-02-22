import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { eq } from "drizzle-orm";

const FLAG_DEFAULTS: Record<string, boolean> = {
  auth: true,
  events_engine: true,
  social_media_studio: true,
  discord_integration: true,
  community_board: true,
  landing_page: true,
  ai_captions: true,
  business_directory: true,
  recurring_events: true,
  user_profiles: true,
};

let cache: { flags: Record<string, boolean>; at: number } | null = null;
const CACHE_TTL = 60_000;

function loadFlags(): Record<string, boolean> {
  if (cache && Date.now() - cache.at < CACHE_TTL) {
    return cache.flags;
  }

  const merged = { ...FLAG_DEFAULTS };

  try {
    const rows = db.select().from(featureFlags).all();
    for (const row of rows) {
      merged[row.key] = row.enabled;
    }
  } catch {
    // DB not ready — use defaults
  }

  cache = { flags: merged, at: Date.now() };
  return merged;
}

export function isFeatureEnabled(key: string): boolean {
  const flags = loadFlags();
  return flags[key] ?? FLAG_DEFAULTS[key] ?? true;
}

export function getAllFeatureFlags(): Record<string, boolean> {
  return { ...loadFlags() };
}

export function getFeatureFlagDetails() {
  try {
    return db.select().from(featureFlags).all();
  } catch {
    return [];
  }
}

export function setFeatureFlag(key: string, enabled: boolean): void {
  const existing = db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .get();

  if (existing) {
    db.update(featureFlags)
      .set({ enabled })
      .where(eq(featureFlags.key, key))
      .run();
  } else {
    db.insert(featureFlags)
      .values({
        key,
        name: key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        enabled,
      })
      .run();
  }

  cache = null;
}

export function invalidateFeatureFlagCache(): void {
  cache = null;
}
