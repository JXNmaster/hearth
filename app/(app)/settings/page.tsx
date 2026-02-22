import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { MessageCircle, User, Shield } from "lucide-react";

export const metadata = {
  title: "Settings - Hearth",
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="space-y-4">
        <Link href="/profile">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <User className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Profile</p>
                <p className="text-sm text-muted-foreground">
                  Edit your display name, bio, and interests
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/discord">
          <Card className="transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <MessageCircle className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium">Discord Integration</p>
                <p className="text-sm text-muted-foreground">
                  Configure webhook and auto-posting
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {user?.isAdmin && (
          <Link href="/admin">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 pt-6">
                <Shield className="h-8 w-8 text-primary" />
                <div className="flex items-center gap-2">
                  <p className="font-medium">Admin Panel</p>
                  <Badge variant="default" className="text-xs">Admin</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Feature flags, user management, moderation
                </p>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member since</span>
            <span>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "Unknown"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span>{user?.isAdmin ? "Admin" : "Member"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
