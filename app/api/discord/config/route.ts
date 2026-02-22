import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { discordConfig, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { discordConfigSchema } from "@/lib/validators";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = db.select().from(discordConfig).limit(1).get();
  return NextResponse.json({ data: config ?? null });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = discordConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = db.select().from(discordConfig).limit(1).get();

    if (existing) {
      const updated = db
        .update(discordConfig)
        .set({ ...parsed.data, updatedAt: new Date().toISOString() })
        .where(eq(discordConfig.id, existing.id))
        .returning()
        .get();
      return NextResponse.json({ data: updated });
    } else {
      const created = db
        .insert(discordConfig)
        .values(parsed.data)
        .returning()
        .get();
      return NextResponse.json({ data: created }, { status: 201 });
    }
  } catch (err) {
    console.error("Discord config error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
