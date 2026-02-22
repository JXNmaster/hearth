export const EVENT_CATEGORIES = [
  { value: "watch_party", label: "Watch Party", emoji: "📺" },
  { value: "meetup", label: "Meetup", emoji: "🤝" },
  { value: "game_night", label: "Game Night", emoji: "🎮" },
  { value: "discussion", label: "Discussion", emoji: "💬" },
  { value: "workshop", label: "Workshop", emoji: "🛠️" },
  { value: "social", label: "Social", emoji: "🎉" },
  { value: "other", label: "Other", emoji: "✨" },
] as const;

export const POST_CATEGORIES = [
  { value: "announcement", label: "Announcement" },
  { value: "discussion", label: "Discussion" },
  { value: "question", label: "Question" },
  { value: "resource", label: "Resource" },
] as const;

export const BUSINESS_CATEGORIES = [
  { value: "food_drink", label: "Food & Drink" },
  { value: "entertainment", label: "Entertainment" },
  { value: "services", label: "Services" },
  { value: "shopping", label: "Shopping" },
  { value: "health", label: "Health" },
  { value: "other", label: "Other" },
] as const;

export const LOCATION_TYPES = [
  { value: "in_person", label: "In Person" },
  { value: "virtual", label: "Virtual" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "members_only", label: "Members Only" },
  { value: "private", label: "Private" },
] as const;

export function getCategoryEmoji(category: string): string {
  return (
    EVENT_CATEGORIES.find((c) => c.value === category)?.emoji ?? "✨"
  );
}

export function getCategoryLabel(category: string): string {
  return (
    EVENT_CATEGORIES.find((c) => c.value === category)?.label ?? "Other"
  );
}
