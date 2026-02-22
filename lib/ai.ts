import { format } from "date-fns";

interface EventData {
  title: string;
  description?: string | null;
  dateStart: string;
  location?: string | null;
  category: string;
}

export async function generateCaption(
  event: EventData,
  tone: string = "friendly"
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return buildTemplateCaption(event);
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Write a ${tone} Instagram caption for this community event. Keep it under 150 words. Include relevant emoji. Don't use hashtags.

Event: ${event.title}
Date: ${format(new Date(event.dateStart), "EEEE, MMMM d, yyyy")}
Location: ${event.location ?? "TBD"}
Description: ${event.description ?? "Community event"}
Category: ${event.category.replace(/_/g, " ")}`,
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : buildTemplateCaption(event);
  } catch {
    return buildTemplateCaption(event);
  }
}

function buildTemplateCaption(event: EventData): string {
  const dateStr = format(new Date(event.dateStart), "EEEE, MMMM d");
  const locationStr = event.location ? ` at ${event.location}` : "";
  return `Join us for ${event.title}! ${dateStr}${locationStr}. Everyone is welcome. 💜`;
}
