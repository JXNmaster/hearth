"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Star, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RsvpButtonProps {
  eventId: string;
  initialStatus: string | null;
}

export function RsvpButton({ eventId, initialStatus }: RsvpButtonProps) {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  async function handleRsvp(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus === status ? "not_going" : newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error("Failed to update RSVP");
        return;
      }

      setStatus(data.data.status);
      if (data.data.status === "going") {
        toast.success("You're going!");
      } else if (data.data.status === "interested") {
        toast.success("Marked as interested");
      } else {
        toast("RSVP removed");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => handleRsvp("going")}
        disabled={loading}
        variant={status === "going" ? "default" : "outline"}
        size="sm"
        className={cn(status === "going" && "bg-green-600 hover:bg-green-700")}
      >
        <Check className="mr-1 h-4 w-4" />
        Going
      </Button>
      <Button
        onClick={() => handleRsvp("interested")}
        disabled={loading}
        variant={status === "interested" ? "default" : "outline"}
        size="sm"
        className={cn(
          status === "interested" && "bg-secondary hover:bg-secondary/90"
        )}
      >
        <Star className="mr-1 h-4 w-4" />
        Interested
      </Button>
    </div>
  );
}
