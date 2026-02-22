import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { signupSchema } from "@/lib/validators";
import { eq, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, password, displayName, pronouns } = parsed.data;

    const existing = db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // First user becomes admin
    const userCount = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .get();
    const isFirstUser = (userCount?.count ?? 0) === 0;

    const newUser = db
      .insert(users)
      .values({
        email,
        passwordHash,
        displayName,
        pronouns: pronouns ?? null,
        isAdmin: isFirstUser,
      })
      .returning()
      .get();

    return NextResponse.json(
      {
        data: {
          id: newUser.id,
          email: newUser.email,
          displayName: newUser.displayName,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
