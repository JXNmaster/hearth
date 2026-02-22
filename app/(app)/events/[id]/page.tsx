import { db } from "@/db";
import { events, rsvps, users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { RsvpButton } from "@/components/events/rsvp-button";
import { DiscordPushButton } from "@/components/discord/discord-push-button";
import {
  Calendar,
  MapPin,
  Clock,
  Users as UsersIcon,
  Edit,
  Palette,
} from "lucide-react";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/constants";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = db.select().from(events).where(eq(events.id, id)).get();
  return { title: event ? `${event.title} - Hearth` : "Event - Hearth" };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const event = db.select().from(events).where(eq(events.id, id)).get();
  if (!event) notFound();

  const creator = db
    .select({ displayName: users.displayName, pronouns: users.pronouns })
    .from(users)
    .where(eq(users.id, event.creatorId))
    .get();

  const rsvpCounts = db
    .select({
      going: sql<number>`sum(case when status = 'going' then 1 else 0 end)`,
      interested: sql<number>`sum(case when status = 'interested' then 1 else 0 end)`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, id))
    .get();

  const userRsvp = session?.user?.id
    ? db
        .select()
        .from(rsvps)
        .where(
          sql`${rsvps.eventId} = ${id} AND ${rsvps.userId} = ${session.user.id}`
        )
        .get()
    : null;

  const attendees = db
    .select({
      displayName: users.displayName,
      pronouns: users.pronouns,
      status: rsvps.status,
    })
    .from(rsvps)
    .innerJoin(users, eq(rsvps.userId, users.id))
    .where(eq(rsvps.eventId, id))
    .all();

  const isCreator = session?.user?.id === event.creatorId;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div>
        <Badge variant="secondary" className="mb-3">
          {getCategoryEmoji(event.category)}{" "}
          {getCategoryLabel(event.category)}
        </Badge>
        <h1 className="text-2xl font-bold md:text-3xl">{event.title}</h1>
        {creator && (
          <p className="mt-1 text-muted-foreground">
            Organized by {creator.displayName}
            {creator.pronouns && (
              <span className="text-muted-foreground/70">
                {" "}
                ({creator.pronouns})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <RsvpButton eventId={id} initialStatus={userRsvp?.status ?? null} />
        {isCreator && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/events/${id}/edit`}>
              <Edit className="mr-1 h-4 w-4" />
              Edit
            </Link>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/events/${id}/studio`}>
            <Palette className="mr-1 h-4 w-4" />
            Create Post
          </Link>
        </Button>
        <DiscordPushButton eventId={id} />
      </div>

      {/* Details */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">
                {format(new Date(event.dateStart), "EEEE, MMMM d, yyyy")}
              </p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(event.dateStart), "h:mm a")}
                {event.dateEnd &&
                  ` - ${format(new Date(event.dateEnd), "h:mm a")}`}
              </p>
            </div>
          </div>

          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{event.location}</p>
                <p className="text-sm capitalize text-muted-foreground">
                  {event.locationType.replace("_", " ")}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3">
            <UsersIcon className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">
                {rsvpCounts?.going ?? 0} going &middot;{" "}
                {rsvpCounts?.interested ?? 0} interested
              </p>
              {event.capacity && (
                <p className="text-sm text-muted-foreground">
                  {event.capacity} spots total
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About this event</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {event.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Attendees */}
      {attendees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Who&apos;s coming ({attendees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {attendees.map((a, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {a.displayName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{a.displayName}</p>
                    {a.pronouns && (
                      <p className="text-xs text-muted-foreground">
                        {a.pronouns}
                      </p>
                    )}
                  </div>
                  <Badge variant="muted" className="ml-auto text-xs">
                    {a.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
