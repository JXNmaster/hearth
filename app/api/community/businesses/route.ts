import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createBusinessSchema } from "@/lib/validators";

export async function GET() {
  if (!isFeatureEnabled("business_directory")) {
    return NextResponse.json(
      { error: "Business directory is disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allBusinesses = db.select().from(businesses).all();
  return NextResponse.json({ data: allBusinesses });
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("business_directory")) {
    return NextResponse.json(
      { error: "Business directory is disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createBusinessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newBusiness = db
      .insert(businesses)
      .values({
        ...parsed.data,
        website: parsed.data.website || null,
        submittedBy: session.user.id,
      })
      .returning()
      .get();

    return NextResponse.json({ data: newBusiness }, { status: 201 });
  } catch (err) {
    console.error("Create business error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
