"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export function EventFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");

  function setFilter(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/events?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search events..."
          className="pl-9"
          defaultValue={searchParams.get("search") ?? ""}
          onChange={(e) => {
            const value = e.target.value;
            if (value) {
              setFilter("search", value);
            } else {
              setFilter("search", null);
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("category", null)}
          className="focus:outline-none"
        >
          <Badge
            variant={!activeCategory ? "default" : "outline"}
            className={cn(
              "cursor-pointer transition-colors",
              !activeCategory && "bg-primary"
            )}
          >
            All
          </Badge>
        </button>
        {EVENT_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() =>
              setFilter(
                "category",
                activeCategory === cat.value ? null : cat.value
              )
            }
            className="focus:outline-none"
          >
            <Badge
              variant={activeCategory === cat.value ? "default" : "outline"}
              className={cn(
                "cursor-pointer transition-colors",
                activeCategory === cat.value && "bg-primary"
              )}
            >
              {cat.emoji} {cat.label}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
