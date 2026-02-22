import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignupForm } from "@/components/auth/signup-form";
import Link from "next/link";
import { Flame } from "lucide-react";

export const metadata = {
  title: "Sign Up - Hearth",
};

export default function SignupPage() {
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
            <CardTitle>Join Hearth</CardTitle>
            <CardDescription>
              Create your account and find your community
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignupForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
