"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Sparkles, Copy, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    id: "instagram_post",
    label: "Instagram Post",
    dimensions: "1080 x 1080",
    aspect: "aspect-square",
  },
  {
    id: "instagram_story",
    label: "Instagram Story",
    dimensions: "1080 x 1920",
    aspect: "aspect-[9/16]",
  },
  {
    id: "flyer",
    label: "Flyer",
    dimensions: "1080 x 1350",
    aspect: "aspect-[4/5]",
  },
];

export default function StudioPage() {
  const { id } = useParams();
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState("instagram_post");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  async function generateImage() {
    setGenerating(true);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id, template: selectedTemplate }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to generate image");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      toast.success("Image generated!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  async function generateAICaption() {
    setGeneratingCaption(true);
    try {
      const res = await fetch("/api/studio/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to generate caption");
        return;
      }

      setCaption(data.data.caption);
      toast.success("Caption generated!");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setGeneratingCaption(false);
    }
  }

  function downloadImage() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `hearth-${selectedTemplate}-${(id as string).slice(0, 8)}.png`;
    a.click();
  }

  function copyCaption() {
    navigator.clipboard.writeText(caption);
    toast.success("Caption copied!");
  }

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Social Media Studio</h1>
        <p className="text-muted-foreground">
          Generate on-brand social media posts for this event
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-6">
          {/* Template Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choose Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => {
                      setSelectedTemplate(tmpl.id);
                      setPreviewUrl(null);
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-lg border p-3 text-left transition-colors",
                      selectedTemplate === tmpl.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <div>
                      <p className="font-medium">{tmpl.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {tmpl.dimensions}
                      </p>
                    </div>
                    {selectedTemplate === tmpl.id && (
                      <Badge variant="default">Selected</Badge>
                    )}
                  </button>
                ))}
              </div>

              <Button
                onClick={generateImage}
                disabled={generating}
                className="mt-4 w-full"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                {generating ? "Generating..." : "Generate Image"}
              </Button>
            </CardContent>
          </Card>

          {/* Caption */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Caption</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption or generate one with AI..."
                rows={4}
              />
              <div className="flex gap-2">
                <Button
                  onClick={generateAICaption}
                  disabled={generatingCaption}
                  variant="outline"
                  size="sm"
                >
                  <Sparkles className="mr-1 h-4 w-4" />
                  {generatingCaption ? "Generating..." : "AI Caption"}
                </Button>
                {caption && (
                  <Button
                    onClick={copyCaption}
                    variant="outline"
                    size="sm"
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    Copy
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {previewUrl ? (
                <div className="space-y-4">
                  <img
                    src={previewUrl}
                    alt="Generated social media post"
                    className="w-full rounded-lg border border-border"
                  />
                  <Button onClick={downloadImage} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Download Image
                  </Button>
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50">
                  <div className="text-center">
                    <ImageIcon className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Select a template and click Generate
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
