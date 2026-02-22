"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function DiscordSettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [autoPost, setAutoPost] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/discord/config")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setWebhookUrl(data.data.webhookUrl ?? "");
          setChannelName(data.data.channelName ?? "");
          setAutoPost(data.data.autoPostEvents ?? true);
        }
      })
      .catch(() => {
        // Config might not exist yet
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/discord/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl,
          channelName: channelName || undefined,
          autoPostEvents: autoPost,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(
          typeof data.error === "string"
            ? data.error
            : "Invalid webhook URL format"
        );
        return;
      }

      toast.success("Discord settings saved!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Discord Integration</h1>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Configuration</CardTitle>
          <CardDescription>
            Connect Hearth to your Discord server. Events will be posted as rich
            embeds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                required
              />
              <p className="text-xs text-muted-foreground">
                Create a webhook in your Discord server settings &gt; Integrations &gt; Webhooks
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channelName">
                Channel Name{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="channelName"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="#events"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div>
                <p className="font-medium">Auto-post events</p>
                <p className="text-sm text-muted-foreground">
                  Automatically share new events to Discord
                </p>
              </div>
              <Switch checked={autoPost} onCheckedChange={setAutoPost} />
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
