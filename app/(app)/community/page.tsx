import { db } from "@/db";
import { posts, users, businesses } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeatureFlagGate } from "@/components/feature-flag-gate";
import { Plus, Pin, MapPin, Globe, Phone } from "lucide-react";
import { BUSINESS_CATEGORIES } from "@/lib/constants";

export const metadata = {
  title: "Community - Hearth",
};

export default function CommunityPage() {
  const allPosts = db
    .select({
      id: posts.id,
      title: posts.title,
      content: posts.content,
      category: posts.category,
      pinned: posts.pinned,
      createdAt: posts.createdAt,
      authorName: users.displayName,
    })
    .from(posts)
    .leftJoin(users, eq(posts.authorId, users.id))
    .orderBy(desc(posts.pinned), desc(posts.createdAt))
    .all();

  const allBusinesses = db.select().from(businesses).all();

  return (
    <FeatureFlagGate flag="community_board" fallback={<p>Community board is currently disabled.</p>}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Community</h1>
            <p className="text-muted-foreground">
              Posts, discussions, and local resources
            </p>
          </div>
          <Button asChild>
            <Link href="/community/new">
              <Plus className="mr-1 h-4 w-4" />
              New Post
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="posts">
          <TabsList>
            <TabsTrigger value="posts">Posts</TabsTrigger>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {allPosts.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No posts yet. Start the conversation!
                  </p>
                </CardContent>
              </Card>
            ) : (
              allPosts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          {post.pinned && (
                            <Pin className="h-4 w-4 text-secondary" />
                          )}
                          <Badge variant="muted" className="text-xs">
                            {post.category}
                          </Badge>
                        </div>
                        <h3 className="mb-1 text-base font-semibold">
                          {post.title}
                        </h3>
                        <p className="mb-2 line-clamp-3 text-sm text-muted-foreground">
                          {post.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {post.authorName} &middot;{" "}
                          {format(new Date(post.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="directory" className="space-y-4">
            {allBusinesses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No businesses listed yet. Know a safe space? Add it!
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {allBusinesses.map((biz) => (
                  <Card key={biz.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{biz.name}</CardTitle>
                        {biz.isVerified && (
                          <Badge variant="default" className="text-xs">
                            Verified
                          </Badge>
                        )}
                      </div>
                      <Badge variant="muted" className="w-fit text-xs">
                        {BUSINESS_CATEGORIES.find((c) => c.value === biz.category)
                          ?.label ?? biz.category}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {biz.description && (
                        <p className="text-muted-foreground">
                          {biz.description}
                        </p>
                      )}
                      {biz.address && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 shrink-0" />
                          <span>{biz.address}</span>
                        </div>
                      )}
                      {biz.website && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Globe className="h-4 w-4 shrink-0" />
                          <a
                            href={biz.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {biz.website}
                          </a>
                        </div>
                      )}
                      {biz.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span>{biz.phone}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="resources">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <h3 className="font-semibold">Community Resources</h3>
                <div className="space-y-3">
                  <ResourceLink
                    title="The Trevor Project"
                    description="24/7 crisis support for LGBTQ+ youth"
                    url="https://www.thetrevorproject.org/"
                  />
                  <ResourceLink
                    title="Trans Lifeline"
                    description="Peer support for trans people"
                    url="https://translifeline.org/"
                  />
                  <ResourceLink
                    title="PFLAG"
                    description="Support for LGBTQ+ people, their parents, and families"
                    url="https://pflag.org/"
                  />
                  <ResourceLink
                    title="It Gets Better Project"
                    description="Stories and resources for LGBTQ+ youth"
                    url="https://itgetsbetter.org/"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </FeatureFlagGate>
  );
}

function ResourceLink({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted"
    >
      <p className="font-medium text-primary">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </a>
  );
}
