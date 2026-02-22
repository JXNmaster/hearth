import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { updateProfileSchema } from "@/lib/validators";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { passwordHash, ...profile } = user;
  return NextResponse.json({ data: profile });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (parsed.data.displayName !== undefined) updateData.displayName = parsed.data.displayName;
    if (parsed.data.pronouns !== undefined) updateData.pronouns = parsed.data.pronouns;
    if (parsed.data.bio !== undefined) updateData.bio = parsed.data.bio;
    if (parsed.data.visibility !== undefined) updateData.visibility = parsed.data.visibility;
    if (parsed.data.interests !== undefined) updateData.interests = JSON.stringify(parsed.data.interests);

    const updated = db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id))
      .returning()
      .get();

    const { passwordHash, ...profile } = updated;
    return NextResponse.json({ data: profile });
  } catch (err) {
    console.error("Update profile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
