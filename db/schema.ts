import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";

// ============ USERS ============
export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  pronouns: text("pronouns"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  interests: text("interests"), // JSON array
  visibility: text("visibility").notNull().default("members_only"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const usersRelations = relations(users, ({ many }) => ({
  events: many(events),
  rsvps: many(rsvps),
  posts: many(posts),
}));

// ============ EVENTS ============
export const events = sqliteTable("events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  creatorId: text("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  dateStart: text("date_start").notNull(),
  dateEnd: text("date_end"),
  location: text("location"),
  locationType: text("location_type").notNull().default("in_person"),
  capacity: integer("capacity"),
  category: text("category").notNull().default("other"),
  imageUrl: text("image_url"),
  isRecurring: integer("is_recurring", { mode: "boolean" })
    .notNull()
    .default(false),
  recurrenceRule: text("recurrence_rule"), // JSON
  discordPosted: integer("discord_posted", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.creatorId],
    references: [users.id],
  }),
  rsvps: many(rsvps),
}));

// ============ RSVPS ============
export const rsvps = sqliteTable(
  "rsvps",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("rsvp_unique").on(table.eventId, table.userId)]
);

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  event: one(events, {
    fields: [rsvps.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [rsvps.userId],
    references: [users.id],
  }),
}));

// ============ COMMUNITY POSTS ============
export const posts = sqliteTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("discussion"),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

// ============ BUSINESS DIRECTORY ============
export const businesses = sqliteTable("business_directory", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  address: text("address"),
  website: text("website"),
  phone: text("phone"),
  isVerified: integer("is_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  submittedBy: text("submitted_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ DISCORD CONFIG ============
export const discordConfig = sqliteTable("discord_config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  webhookUrl: text("webhook_url").notNull(),
  channelName: text("channel_name"),
  autoPostEvents: integer("auto_post_events", { mode: "boolean" })
    .notNull()
    .default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

// ============ FEATURE FLAGS ============
export const featureFlags = sqliteTable("feature_flags", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});
