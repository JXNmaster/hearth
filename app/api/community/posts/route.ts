import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createPostSchema } from "@/lib/validators";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  if (!isFeatureEnabled("community_board")) {
    return NextResponse.json(
      { error: "Community board is disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      category: posts.category,
      pinned: posts.pinned,
      createdAt: posts.createdAt,
      authorName: users.displayName,
      authorPronouns: users.pronouns,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .all();

  return NextResponse.json({ data: allPosts });
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("community_board")) {
    return NextResponse.json(
      { error: "Community board is disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newPost = db
      .insert(posts)
      .values({
        ...parsed.data,
        authorId: session.user.id,
      })
      .returning()
      .get();

    return NextResponse.json({ data: newPost }, { status: 201 });
  } catch (err) {
    console.error("Create post error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
