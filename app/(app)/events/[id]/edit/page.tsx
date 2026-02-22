import { db } from "@/db";
import { events } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventForm } from "@/components/events/event-form";

export const metadata = {
  title: "Edit Event - Hearth",
};

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const event = db.select().from(events).where(eq(events.id, id)).get();
  if (!event) notFound();

  if (event.creatorId !== session.user.id) {
    redirect(`/events/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Edit Event</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm initialData={event} />
        </CardContent>
      </Card>
    </div>
  );
}
