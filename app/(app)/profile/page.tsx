"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VISIBILITY_OPTIONS } from "@/lib/constants";
import { toast } from "sonner";

interface Profile {
  id: string;
  email: string;
  displayName: string;
  pronouns: string | null;
  bio: string | null;
  interests: string | null;
  visibility: string;
  isAdmin: boolean;
  createdAt: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [visibility, setVisibility] = useState("members_only");

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        setProfile(data.data);
        setVisibility(data.data?.visibility ?? "members_only");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const interestsStr = formData.get("interests") as string;
    const interests = interestsStr
      ? interestsStr.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.get("displayName"),
          pronouns: formData.get("pronouns") || undefined,
          bio: formData.get("bio") || undefined,
          interests,
          visibility,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to update profile");
        return;
      }

      const data = await res.json();
      setProfile(data.data);
      toast.success("Profile updated!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!profile) return null;

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const interests = profile.interests
    ? JSON.parse(profile.interests).join(", ")
    : "";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{profile.displayName}</h1>
          {profile.pronouns && (
            <p className="text-muted-foreground">{profile.pronouns}</p>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                name="displayName"
                defaultValue={profile.displayName}
                required
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pronouns">Pronouns</Label>
              <Input
                id="pronouns"
                name="pronouns"
                defaultValue={profile.pronouns ?? ""}
                placeholder="e.g. they/them, she/her, he/him"
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                defaultValue={profile.bio ?? ""}
                placeholder="Tell us about yourself..."
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="interests">Interests</Label>
              <Input
                id="interests"
                name="interests"
                defaultValue={interests}
                placeholder="anime, gaming, art, cooking (comma-separated)"
              />
              <p className="text-xs text-muted-foreground">
                Separate interests with commas
              </p>
            </div>

            <div className="space-y-2">
              <Label>Profile Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
