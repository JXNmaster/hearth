import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Display name is required").max(50),
  pronouns: z.string().max(30).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(5000).optional(),
  dateStart: z.string().min(1, "Start date is required"),
  dateEnd: z.string().optional(),
  location: z.string().max(500).optional(),
  locationType: z.enum(["in_person", "virtual", "hybrid"]).default("in_person"),
  capacity: z.number().int().positive().optional(),
  category: z
    .enum([
      "watch_party",
      "meetup",
      "game_night",
      "discussion",
      "workshop",
      "social",
      "other",
    ])
    .default("other"),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const rsvpSchema = z.object({
  status: z.enum(["going", "interested", "not_going"]),
});

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().min(1, "Content is required").max(10000),
  category: z
    .enum(["announcement", "discussion", "question", "resource"])
    .default("discussion"),
});

export const updatePostSchema = createPostSchema.partial();

export const createBusinessSchema = z.object({
  name: z.string().min(1, "Business name is required").max(200),
  description: z.string().max(2000).optional(),
  category: z
    .enum([
      "food_drink",
      "entertainment",
      "services",
      "shopping",
      "health",
      "other",
    ])
    .default("other"),
  address: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  pronouns: z.string().max(30).optional(),
  bio: z.string().max(500).optional(),
  interests: z.array(z.string()).optional(),
  visibility: z.enum(["public", "members_only", "private"]).optional(),
});

export const discordConfigSchema = z.object({
  webhookUrl: z
    .string()
    .regex(
      /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/,
      "Invalid Discord webhook URL"
    ),
  channelName: z.string().max(100).optional(),
  autoPostEvents: z.boolean().default(true),
});
