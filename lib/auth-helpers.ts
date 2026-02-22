import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSession() {
  return auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();
  if (!user?.isAdmin) {
    throw new Error("Forbidden");
  }
  return session.user;
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get() ?? null;
}
