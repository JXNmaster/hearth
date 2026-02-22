import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4">
      <Flame className="h-16 w-16 text-primary" />
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">
        This page doesn&apos;t exist. Maybe it went out for a walk.
      </p>
      <Button asChild>
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
