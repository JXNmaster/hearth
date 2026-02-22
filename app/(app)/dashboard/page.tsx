import { db } from "@/db";
import { events, rsvps, posts, users } from "@/db/schema";
import { desc, gte, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Users, MessageSquare } from "lucide-react";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/constants";

export const metadata = {
  title: "Dashboard - Hearth",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();

  const upcomingEvents = db
    .select()
    .from(events)
    .where(gte(events.dateStart, new Date().toISOString()))
    .orderBy(events.dateStart)
    .limit(6)
    .all();

  const recentPosts = db
    .select()
    .from(posts)
    .orderBy(desc(posts.createdAt))
    .limit(5)
    .all();

  const totalMembers = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .get();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">
          Welcome back, {user?.displayName ?? session.user.name ?? "friend"}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s what&apos;s happening in your community.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{upcomingEvents.length}</p>
              <p className="text-sm text-muted-foreground">Upcoming Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <Users className="h-8 w-8 text-secondary" />
            <div>
              <p className="text-2xl font-bold">{totalMembers?.count ?? 0}</p>
              <p className="text-sm text-muted-foreground">Community Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 pt-6">
            <MessageSquare className="h-8 w-8 text-accent" />
            <div>
              <p className="text-2xl font-bold">{recentPosts.length}</p>
              <p className="text-sm text-muted-foreground">Recent Posts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Upcoming Events</h2>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/events">View All</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/events/new">
                <Plus className="mr-1 h-4 w-4" />
                Create
              </Link>
            </Button>
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No upcoming events yet.</p>
              <Button asChild className="mt-4" size="sm">
                <Link href="/events/new">Create the first one</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <Badge variant="secondary" className="mb-2">
                        {getCategoryEmoji(event.category)}{" "}
                        {getCategoryLabel(event.category)}
                      </Badge>
                    </div>
                    <CardTitle className="line-clamp-2 text-base">
                      {event.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.dateStart), "EEE, MMM d · h:mm a")}
                    </p>
                    {event.location && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {event.location}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Posts</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/community">View All</Link>
          </Button>
        </div>

        {recentPosts.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">
                No community posts yet. Start the conversation!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => (
              <Card key={post.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{post.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(post.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="muted">{post.category}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
