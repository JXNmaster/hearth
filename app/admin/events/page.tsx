import { db } from "@/db";
import { events, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/constants";

export const metadata = {
  title: "Events - Admin - Hearth",
};

export default function AdminEventsPage() {
  const allEvents = db
    .select({
      id: events.id,
      title: events.title,
      category: events.category,
      dateStart: events.dateStart,
      createdAt: events.createdAt,
      creatorName: users.displayName,
    })
    .from(events)
    .leftJoin(users, eq(events.creatorId, users.id))
    .orderBy(desc(events.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-muted-foreground">
          {allEvents.length} total event{allEvents.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {allEvents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">No events yet.</p>
            </CardContent>
          </Card>
        ) : (
          allEvents.map((event) => (
            <Card key={event.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {getCategoryEmoji(event.category)}{" "}
                      {getCategoryLabel(event.category)}
                    </Badge>
                    <p className="font-medium">{event.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    by {event.creatorName ?? "Unknown"} &middot;{" "}
                    {format(new Date(event.dateStart), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
