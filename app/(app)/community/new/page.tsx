"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POST_CATEGORIES, BUSINESS_CATEGORIES } from "@/lib/constants";
import { toast } from "sonner";

export default function NewCommunityPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [postCategory, setPostCategory] = useState("discussion");
  const [bizCategory, setBizCategory] = useState("other");

  async function handlePostSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          content: formData.get("content"),
          category: postCategory,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to create post");
        return;
      }

      toast.success("Post created!");
      router.push("/community");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleBusinessSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/community/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          description: formData.get("description") || undefined,
          category: bizCategory,
          address: formData.get("address") || undefined,
          website: formData.get("website") || undefined,
          phone: formData.get("phone") || undefined,
        }),
      });

      if (!res.ok) {
        toast.error("Failed to submit business");
        return;
      }

      toast.success("Business added to directory!");
      router.push("/community");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Tabs defaultValue="post">
        <TabsList className="mb-4">
          <TabsTrigger value="post">New Post</TabsTrigger>
          <TabsTrigger value="business">Add Business</TabsTrigger>
        </TabsList>

        <TabsContent value="post">
          <Card>
            <CardHeader>
              <CardTitle>Create a Post</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePostSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    maxLength={200}
                    placeholder="What's on your mind?"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={postCategory} onValueChange={setPostCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POST_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    name="content"
                    required
                    rows={6}
                    maxLength={10000}
                    placeholder="Share your thoughts..."
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Posting..." : "Post"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Add a Safe-Space Business</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBusinessSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Business Name</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    maxLength={200}
                    placeholder="Business name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={bizCategory} onValueChange={setBizCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="Why is this a great safe space?"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" placeholder="123 Main St" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" name="phone" placeholder="(555) 123-4567" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    placeholder="https://example.com"
                  />
                </div>

                <div className="flex gap-4">
                  <Button type="submit" disabled={loading}>
                    {loading ? "Adding..." : "Add Business"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
