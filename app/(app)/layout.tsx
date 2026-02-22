import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getAllFeatureFlags } from "@/lib/feature-flags";
import { FeatureFlagProvider } from "@/components/feature-flag-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const flags = getAllFeatureFlags();

  return (
    <FeatureFlagProvider flags={flags}>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 pb-20 md:pb-6">
          {children}
        </main>
        <MobileNav />
      </div>
    </FeatureFlagProvider>
  );
}
