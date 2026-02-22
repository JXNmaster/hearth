import { db } from "@/db";
import { users, events, posts, businesses } from "@/db/schema";
import { sql } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Calendar, MessageSquare, Store } from "lucide-react";

export const metadata = {
  title: "Admin Dashboard - Hearth",
};

export default function AdminDashboardPage() {
  const userCount = db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .get();
  const eventCount = db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .get();
  const postCount = db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .get();
  const bizCount = db
    .select({ count: sql<number>`count(*)` })
    .from(businesses)
    .get();

  const stats = [
    {
      label: "Total Users",
      value: userCount?.count ?? 0,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Total Events",
      value: eventCount?.count ?? 0,
      icon: Calendar,
      color: "text-secondary",
    },
    {
      label: "Community Posts",
      value: postCount?.count ?? 0,
      icon: MessageSquare,
      color: "text-accent",
    },
    {
      label: "Businesses Listed",
      value: bizCount?.count ?? 0,
      icon: Store,
      color: "text-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
