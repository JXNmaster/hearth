import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import { updatePostSchema } from "@/lib/validators";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = db.select().from(posts).where(eq(posts.id, id)).get();
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get();
  if (post.authorId !== session.user.id && !user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  db.delete(posts).where(eq(posts.id, id)).run();
  return NextResponse.json({ data: { deleted: true } });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const post = db.select().from(posts).where(eq(posts.id, id)).get();
  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updatePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = db
      .update(posts)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(posts.id, id))
      .returning()
      .get();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Update post error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
