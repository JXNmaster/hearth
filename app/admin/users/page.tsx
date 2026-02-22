import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const metadata = {
  title: "Users - Admin - Hearth",
};

export default function AdminUsersPage() {
  const allUsers = db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground">
          {allUsers.length} registered member{allUsers.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="space-y-3">
        {allUsers.map((user) => {
          const initials = user.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <Card key={user.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <Avatar>
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.displayName}</p>
                    {user.pronouns && (
                      <span className="text-sm text-muted-foreground">
                        ({user.pronouns})
                      </span>
                    )}
                    {user.isAdmin && <Badge variant="default">Admin</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
