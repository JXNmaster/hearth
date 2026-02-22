import { format } from "date-fns";

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

interface EventForDiscord {
  title: string;
  description?: string | null;
  dateStart: string;
  dateEnd?: string | null;
  location?: string | null;
  locationType: string;
  category: string;
}

const categoryEmoji: Record<string, string> = {
  watch_party: "📺",
  meetup: "🤝",
  game_night: "🎮",
  discussion: "💬",
  workshop: "🛠️",
  social: "🎉",
  other: "✨",
};

export function formatEventEmbed(event: EventForDiscord): DiscordEmbed {
  const emoji = categoryEmoji[event.category] ?? "✨";

  return {
    title: `${emoji} ${event.title}`,
    description: event.description
      ? event.description.slice(0, 300) +
        (event.description.length > 300 ? "..." : "")
      : undefined,
    color: 0x7c3aed,
    fields: [
      {
        name: "📅 Date",
        value: format(new Date(event.dateStart), "EEEE, MMMM d, yyyy"),
        inline: true,
      },
      {
        name: "🕐 Time",
        value: format(new Date(event.dateStart), "h:mm a"),
        inline: true,
      },
      ...(event.location
        ? [
            {
              name:
                event.locationType === "virtual" ? "💻 Link" : "📍 Location",
              value: event.location,
              inline: false,
            },
          ]
        : []),
    ],
    footer: { text: "Posted from Hearth" },
    timestamp: new Date().toISOString(),
  };
}

export async function sendDiscordWebhook(
  webhookUrl: string,
  embed: DiscordEmbed
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `Discord returned ${response.status}: ${text}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
