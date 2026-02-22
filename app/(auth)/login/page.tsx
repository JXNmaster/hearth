import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";
import { Flame } from "lucide-react";

export const metadata = {
  title: "Sign In - Hearth",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Flame className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Hearth</span>
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
