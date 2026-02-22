import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  getAllFeatureFlags,
  getFeatureFlagDetails,
  setFeatureFlag,
} from "@/lib/feature-flags";
import { eq } from "drizzle-orm";

export async function GET() {
  const flags = getAllFeatureFlags();
  return NextResponse.json({ data: flags });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { key, enabled } = await request.json();
    if (typeof key !== "string" || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    setFeatureFlag(key, enabled);
    return NextResponse.json({ data: { key, enabled } });
  } catch (err) {
    console.error("Feature flag error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
