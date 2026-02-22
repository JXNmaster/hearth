"use client";

import { createContext, useContext } from "react";

type Flags = Record<string, boolean>;

const FeatureFlagContext = createContext<Flags>({});

export function FeatureFlagProvider({
  flags,
  children,
}: {
  flags: Flags;
  children: React.ReactNode;
}) {
  return (
    <FeatureFlagContext.Provider value={flags}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlag(key: string): boolean {
  const flags = useContext(FeatureFlagContext);
  return flags[key] ?? true;
}
