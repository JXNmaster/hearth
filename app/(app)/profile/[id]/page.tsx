import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user || user.visibility === "private") notFound();

  const initials = user.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const interests: string[] = user.interests
    ? JSON.parse(user.interests)
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{user.displayName}</h1>
          {user.pronouns && (
            <p className="text-muted-foreground">{user.pronouns}</p>
          )}
        </div>
      </div>

      {user.bio && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm leading-relaxed">{user.bio}</p>
          </CardContent>
        </Card>
      )}

      {interests.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            Interests
          </h2>
          <div className="flex flex-wrap gap-2">
            {interests.map((interest) => (
              <Badge key={interest} variant="secondary">
                {interest}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
