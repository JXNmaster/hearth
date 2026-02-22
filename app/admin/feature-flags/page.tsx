"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface FlagState {
  [key: string]: boolean;
}

const FLAG_DESCRIPTIONS: Record<string, string> = {
  auth: "User signup and login",
  events_engine: "Event creation, browsing, and RSVP",
  social_media_studio: "Generate branded social media images",
  discord_integration: "Post events to Discord via webhooks",
  community_board: "Community posts and discussions",
  landing_page: "Public landing page",
  ai_captions: "AI-generated social media captions",
  business_directory: "Safe-space business listings",
  recurring_events: "Support for recurring event schedules",
  user_profiles: "User profile pages and settings",
};

export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<FlagState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/feature-flags")
      .then((res) => res.json())
      .then((data) => setFlags(data.data ?? {}))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFlag(key: string, enabled: boolean) {
    setFlags((prev) => ({ ...prev, [key]: enabled }));

    try {
      const res = await fetch("/api/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });

      if (!res.ok) {
        setFlags((prev) => ({ ...prev, [key]: !enabled }));
        toast.error("Failed to update flag");
        return;
      }

      toast.success(`${key} ${enabled ? "enabled" : "disabled"}`);
    } catch {
      setFlags((prev) => ({ ...prev, [key]: !enabled }));
      toast.error("Something went wrong");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feature Flags</h1>
        <p className="text-muted-foreground">
          Toggle features on and off for the entire application
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(flags).map(([key, enabled]) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">
                  {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-sm text-muted-foreground">
                  {FLAG_DESCRIPTIONS[key] ?? key}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => toggleFlag(key, checked)}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
