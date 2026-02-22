import { isFeatureEnabled } from "@/lib/feature-flags";

interface Props {
  flag: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlagGate({ flag, children, fallback = null }: Props) {
  if (!isFeatureEnabled(flag)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
