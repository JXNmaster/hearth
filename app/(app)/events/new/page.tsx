import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventForm } from "@/components/events/event-form";

export const metadata = {
  title: "Create Event - Hearth",
};

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Create Event</CardTitle>
        </CardHeader>
        <CardContent>
          <EventForm />
        </CardContent>
      </Card>
    </div>
  );
}
