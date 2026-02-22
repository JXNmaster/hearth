"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useFeatureFlag } from "@/components/feature-flag-provider";

interface DiscordPushButtonProps {
  eventId: string;
}

export function DiscordPushButton({ eventId }: DiscordPushButtonProps) {
  const [loading, setLoading] = useState(false);
  const enabled = useFeatureFlag("discord_integration");

  if (!enabled) return null;

  async function handlePush() {
    setLoading(true);
    try {
      const res = await fetch("/api/discord/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to post to Discord");
        return;
      }

      toast.success("Posted to Discord!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handlePush}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      <MessageCircle className="mr-1 h-4 w-4" />
      {loading ? "Posting..." : "Share to Discord"}
    </Button>
  );
}
