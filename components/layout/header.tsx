"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Calendar, Users, Palette, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { UserMenu } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Home", icon: Flame },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/community", label: "Community", icon: Users },
];

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Hearth</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  pathname.startsWith(link.href)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
