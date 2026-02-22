import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, Calendar, Users, Palette, MessageCircle, Shield } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-32">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6 flex items-center gap-3">
              <Flame className="h-12 w-12 text-primary md:h-16 md:w-16" />
              <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
                Hearth
              </h1>
            </div>
            <p className="mb-2 text-xl text-muted-foreground md:text-2xl">
              Your community, your space.
            </p>
            <p className="mb-8 max-w-2xl text-base text-muted-foreground md:text-lg">
              A safe place to find your people, plan gatherings, and build real
              connections. From anime watch parties to community meetups, this is
              where it starts.
            </p>
            <div className="flex gap-4">
              <Button asChild size="lg">
                <Link href="/signup">Join Hearth</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <h2 className="mb-12 text-center text-2xl font-bold md:text-3xl">
          Everything your community needs
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={Calendar}
            title="Events"
            description="Organize watch parties, game nights, meetups, and more. RSVP tracking, categories, and recurring events built in."
          />
          <FeatureCard
            icon={Palette}
            title="Social Media Studio"
            description="Generate beautiful, on-brand social media posts for your events. Download ready-to-share images instantly."
          />
          <FeatureCard
            icon={MessageCircle}
            title="Discord Integration"
            description="Events auto-post to your Discord server. Keep your community synced across platforms."
          />
          <FeatureCard
            icon={Users}
            title="Community Board"
            description="Share announcements, start discussions, and find safe-space businesses in your area."
          />
          <FeatureCard
            icon={Shield}
            title="Safe Space"
            description="Privacy controls, member-only visibility, and a community built on mutual respect and belonging."
          />
          <FeatureCard
            icon={Flame}
            title="Your Hearth"
            description="A warm, inviting hub that bridges online community into real-life connection. Start local, grow together."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/50">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center md:py-24">
          <h2 className="mb-4 text-2xl font-bold md:text-3xl">
            Ready to find your people?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Every community starts with someone. Be that someone.
          </p>
          <Button asChild size="lg">
            <Link href="/signup">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">Hearth</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Your community, your space.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="pt-6">
        <Icon className="mb-4 h-8 w-8 text-primary" />
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
