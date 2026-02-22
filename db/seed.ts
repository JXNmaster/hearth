import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import path from "path";

const sqlite = new Database(path.join(process.cwd(), "hearth.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const db = drizzle(sqlite, { schema });

const DEFAULT_FLAGS = [
  { key: "auth", name: "Authentication", description: "User signup and login" },
  { key: "events_engine", name: "Events Engine", description: "Event creation, browsing, and RSVP" },
  { key: "social_media_studio", name: "Social Media Studio", description: "Generate branded social media images" },
  { key: "discord_integration", name: "Discord Integration", description: "Post events to Discord via webhooks" },
  { key: "community_board", name: "Community Board", description: "Community posts and discussions" },
  { key: "landing_page", name: "Landing Page", description: "Public landing page" },
  { key: "ai_captions", name: "AI Captions", description: "AI-generated social media captions" },
  { key: "business_directory", name: "Business Directory", description: "Safe-space business listings" },
  { key: "recurring_events", name: "Recurring Events", description: "Support for recurring event schedules" },
  { key: "user_profiles", name: "User Profiles", description: "User profile pages and settings" },
];

console.log("Seeding feature flags...");
for (const flag of DEFAULT_FLAGS) {
  const existing = db
    .select()
    .from(schema.featureFlags)
    .where(eq(schema.featureFlags.key, flag.key))
    .get();

  if (!existing) {
    db.insert(schema.featureFlags)
      .values({ ...flag, enabled: true })
      .run();
    console.log(`  Created flag: ${flag.key}`);
  } else {
    console.log(`  Flag already exists: ${flag.key}`);
  }
}

console.log("Seed complete!");
sqlite.close();
