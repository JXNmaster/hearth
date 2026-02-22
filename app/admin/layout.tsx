import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { Flame, ToggleLeft, Users, Calendar, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();
  if (!user?.isAdmin) redirect("/dashboard");

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: Flame },
    { href: "/admin/feature-flags", label: "Feature Flags", icon: ToggleLeft },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/events", label: "Events", icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-border bg-card md:block">
          <div className="sticky top-0 space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Admin</span>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to app
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
