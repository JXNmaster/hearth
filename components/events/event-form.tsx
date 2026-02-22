"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { EVENT_CATEGORIES, LOCATION_TYPES } from "@/lib/constants";
import { toast } from "sonner";

interface EventFormProps {
  initialData?: {
    id: string;
    title: string;
    description?: string | null;
    dateStart: string;
    dateEnd?: string | null;
    location?: string | null;
    locationType: string;
    capacity?: number | null;
    category: string;
  };
}

export function EventForm({ initialData }: EventFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(initialData?.category ?? "other");
  const [locationType, setLocationType] = useState(
    initialData?.locationType ?? "in_person"
  );

  const isEditing = !!initialData;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get("title") as string,
      description: (formData.get("description") as string) || undefined,
      dateStart: new Date(formData.get("dateStart") as string).toISOString(),
      dateEnd: formData.get("dateEnd")
        ? new Date(formData.get("dateEnd") as string).toISOString()
        : undefined,
      location: (formData.get("location") as string) || undefined,
      locationType,
      capacity: formData.get("capacity")
        ? Number(formData.get("capacity"))
        : undefined,
      category,
    };

    try {
      const url = isEditing
        ? `/api/events/${initialData.id}`
        : "/api/events";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(
          typeof result.error === "string"
            ? result.error
            : "Something went wrong"
        );
        return;
      }

      toast.success(isEditing ? "Event updated!" : "Event created!");
      router.push(`/events/${result.data.id}`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // Format date for datetime-local input
  function formatForInput(isoString?: string | null) {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Event Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={initialData?.title}
          placeholder="e.g., Saturday Anime Watch Party"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initialData?.description ?? ""}
          placeholder="What's this event about? What should people bring or know?"
          rows={4}
          maxLength={5000}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="dateStart">Start Date & Time</Label>
          <Input
            id="dateStart"
            name="dateStart"
            type="datetime-local"
            defaultValue={formatForInput(initialData?.dateStart)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dateEnd">
            End Date & Time{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="dateEnd"
            name="dateEnd"
            type="datetime-local"
            defaultValue={formatForInput(initialData?.dateEnd)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.emoji} {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Location Type</Label>
          <Select value={locationType} onValueChange={setLocationType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATION_TYPES.map((lt) => (
                <SelectItem key={lt.value} value={lt.value}>
                  {lt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">
            {locationType === "virtual" ? "Meeting Link" : "Location"}
          </Label>
          <Input
            id="location"
            name="location"
            defaultValue={initialData?.location ?? ""}
            placeholder={
              locationType === "virtual"
                ? "e.g., Discord voice channel link"
                : "e.g., 123 Main St, Room 4"
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacity">
            Capacity <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            defaultValue={initialData?.capacity ?? ""}
            placeholder="Leave blank for unlimited"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save Changes"
              : "Create Event"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
