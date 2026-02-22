import { Suspense } from "react";
import { db } from "@/db";
import { events, rsvps } from "@/db/schema";
import { desc, eq, gte, like, sql } from "drizzle-orm";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { EventFilters } from "@/components/events/event-filters";
import { Plus, Calendar } from "lucide-react";
import { FeatureFlagGate } from "@/components/feature-flag-gate";

export const metadata = {
  title: "Events - Hearth",
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string }>;
}) {
  const params = await searchParams;

  const conditions = [];
  if (params.category) {
    conditions.push(eq(events.category, params.category));
  }
  if (params.search) {
    conditions.push(like(events.title, `%${params.search}%`));
  }

  const allEvents = db
    .select()
    .from(events)
    .where(
      conditions.length === 0
        ? undefined
        : conditions.length === 1
          ? conditions[0]
          : sql`${conditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} AND ${b}`)}`
    )
    .orderBy(events.dateStart)
    .all();

  const eventsWithCounts = allEvents.map((event) => {
    const counts = db
      .select({
        going: sql<number>`sum(case when status = 'going' then 1 else 0 end)`,
        interested: sql<number>`sum(case when status = 'interested' then 1 else 0 end)`,
      })
      .from(rsvps)
      .where(eq(rsvps.eventId, event.id))
      .get();

    return {
      ...event,
      goingCount: counts?.going ?? 0,
      interestedCount: counts?.interested ?? 0,
    };
  });

  return (
    <FeatureFlagGate flag="events_engine" fallback={<p>Events are currently disabled.</p>}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Events</h1>
            <p className="text-muted-foreground">
              Find something happening near you
            </p>
          </div>
          <Button asChild>
            <Link href="/events/new">
              <Plus className="mr-1 h-4 w-4" />
              Create Event
            </Link>
          </Button>
        </div>

        <Suspense fallback={<div className="h-20 animate-pulse rounded-lg bg-muted" />}>
          <EventFilters />
        </Suspense>

        {eventsWithCounts.length === 0 ? (
          <div className="py-12 text-center">
            <Calendar className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No events found</h3>
            <p className="mb-4 text-muted-foreground">
              {params.category || params.search
                ? "Try adjusting your filters"
                : "Be the first to create an event!"}
            </p>
            <Button asChild>
              <Link href="/events/new">Create Event</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {eventsWithCounts.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </FeatureFlagGate>
  );
}
