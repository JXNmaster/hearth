import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Users } from "lucide-react";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/constants";

interface EventCardProps {
  event: {
    id: string;
    title: string;
    description?: string | null;
    dateStart: string;
    location?: string | null;
    locationType: string;
    category: string;
    capacity?: number | null;
    goingCount?: number;
    interestedCount?: number;
  };
}

export function EventCard({ event }: EventCardProps) {
  return (
    <Link href={`/events/${event.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
        <CardHeader className="pb-2">
          <Badge variant="secondary" className="mb-2 w-fit">
            {getCategoryEmoji(event.category)}{" "}
            {getCategoryLabel(event.category)}
          </Badge>
          <CardTitle className="line-clamp-2 text-base">
            {event.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>{format(new Date(event.dateStart), "EEE, MMM d · h:mm a")}</span>
          </div>

          {event.location && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{event.location}</span>
            </div>
          )}

          {(event.goingCount ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              <span>
                {event.goingCount} going
                {(event.interestedCount ?? 0) > 0 &&
                  ` · ${event.interestedCount} interested`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
