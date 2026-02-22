import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";
import { format } from "date-fns";
import { getCategoryEmoji, getCategoryLabel } from "@/lib/constants";
import type { ReactNode } from "react";

const interRegular = fs.readFileSync(
  path.join(process.cwd(), "public/fonts/Inter-Regular.otf")
);
const interBold = fs.readFileSync(
  path.join(process.cwd(), "public/fonts/Inter-Bold.otf")
);

interface EventData {
  title: string;
  description?: string | null;
  dateStart: string;
  dateEnd?: string | null;
  location?: string | null;
  category: string;
}

type TemplateType = "instagram_post" | "instagram_story" | "flyer";

const DIMENSIONS = {
  instagram_post: { width: 1080, height: 1080 },
  instagram_story: { width: 1080, height: 1920 },
  flyer: { width: 1080, height: 1350 },
};

function createInstagramPost(event: EventData): ReactNode {
  const { createElement: h } = require("react");

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #0F0B1A 0%, #1A1625 40%, #2D1B69 100%)",
        padding: "60px",
        fontFamily: "Inter",
        color: "white",
      },
    },
    // Category badge
    h(
      "div",
      {
        style: {
          display: "flex",
          background: "#F59E0B",
          color: "#0F0B1A",
          padding: "10px 24px",
          borderRadius: "999px",
          fontSize: "24px",
          fontWeight: 700,
          alignSelf: "flex-start",
        },
      },
      `${getCategoryEmoji(event.category)} ${getCategoryLabel(event.category).toUpperCase()}`
    ),
    // Title
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: event.title.length > 40 ? "48px" : "64px",
          fontWeight: 700,
          marginTop: "40px",
          lineHeight: 1.2,
          color: "white",
        },
      },
      event.title
    ),
    // Description
    event.description
      ? h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: "24px",
              marginTop: "20px",
              color: "#a09bab",
              lineHeight: 1.4,
            },
          },
          event.description.slice(0, 120) + (event.description.length > 120 ? "..." : "")
        )
      : null,
    // Spacer
    h("div", { style: { display: "flex", flex: 1 } }),
    // Date + Location
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        },
      },
      h(
        "div",
        { style: { display: "flex", fontSize: "28px", color: "#EC4899" } },
        format(new Date(event.dateStart), "EEEE, MMMM d \u00B7 h:mm a")
      ),
      event.location
        ? h(
            "div",
            { style: { display: "flex", fontSize: "24px", color: "#a78bfa" } },
            event.location
          )
        : null
    ),
    // Branding
    h(
      "div",
      {
        style: {
          display: "flex",
          marginTop: "30px",
          alignItems: "center",
          gap: "8px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "20px",
            color: "#7C3AED",
            fontWeight: 700,
            letterSpacing: "2px",
          },
        },
        "\uD83D\uDD25 HEARTH"
      )
    )
  );
}

function createInstagramStory(event: EventData): ReactNode {
  const { createElement: h } = require("react");

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #2D1B69 0%, #0F0B1A 40%, #1A1625 100%)",
        padding: "80px 50px",
        fontFamily: "Inter",
        color: "white",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
      },
    },
    // Category badge
    h(
      "div",
      {
        style: {
          display: "flex",
          background: "#F59E0B",
          color: "#0F0B1A",
          padding: "12px 28px",
          borderRadius: "999px",
          fontSize: "28px",
          fontWeight: 700,
        },
      },
      `${getCategoryEmoji(event.category)} ${getCategoryLabel(event.category).toUpperCase()}`
    ),
    // Title
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: event.title.length > 30 ? "56px" : "72px",
          fontWeight: 700,
          marginTop: "60px",
          lineHeight: 1.2,
          color: "white",
          textAlign: "center",
          justifyContent: "center",
        },
      },
      event.title
    ),
    // Date
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "32px",
          marginTop: "40px",
          color: "#EC4899",
          justifyContent: "center",
        },
      },
      format(new Date(event.dateStart), "EEEE, MMMM d")
    ),
    // Time
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "32px",
          marginTop: "8px",
          color: "#EC4899",
          justifyContent: "center",
        },
      },
      format(new Date(event.dateStart), "h:mm a")
    ),
    // Location
    event.location
      ? h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: "26px",
              marginTop: "24px",
              color: "#a78bfa",
              justifyContent: "center",
            },
          },
          event.location
        )
      : null,
    // Branding
    h(
      "div",
      {
        style: {
          display: "flex",
          marginTop: "80px",
          fontSize: "24px",
          color: "#7C3AED",
          fontWeight: 700,
          letterSpacing: "2px",
          justifyContent: "center",
        },
      },
      "\uD83D\uDD25 HEARTH"
    )
  );
}

function createFlyer(event: EventData): ReactNode {
  const { createElement: h } = require("react");

  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(160deg, #1A1625 0%, #0F0B1A 50%, #2D1B69 100%)",
        padding: "60px",
        fontFamily: "Inter",
        color: "white",
      },
    },
    // Header
    h(
      "div",
      {
        style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "22px",
            color: "#7C3AED",
            fontWeight: 700,
            letterSpacing: "2px",
          },
        },
        "\uD83D\uDD25 HEARTH"
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            background: "#F59E0B",
            color: "#0F0B1A",
            padding: "8px 20px",
            borderRadius: "999px",
            fontSize: "20px",
            fontWeight: 700,
          },
        },
        getCategoryLabel(event.category).toUpperCase()
      )
    ),
    // Title
    h(
      "div",
      {
        style: {
          display: "flex",
          fontSize: event.title.length > 40 ? "52px" : "64px",
          fontWeight: 700,
          marginTop: "50px",
          lineHeight: 1.2,
        },
      },
      event.title
    ),
    // Description
    event.description
      ? h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: "24px",
              marginTop: "24px",
              color: "#a09bab",
              lineHeight: 1.5,
            },
          },
          event.description.slice(0, 200) + (event.description.length > 200 ? "..." : "")
        )
      : null,
    // Spacer
    h("div", { style: { display: "flex", flex: 1 } }),
    // Event details
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          borderTop: "1px solid #302b3d",
          paddingTop: "30px",
        },
      },
      h(
        "div",
        { style: { display: "flex", fontSize: "28px", color: "#EC4899" } },
        `📅 ${format(new Date(event.dateStart), "EEEE, MMMM d, yyyy")}`
      ),
      h(
        "div",
        { style: { display: "flex", fontSize: "28px", color: "#EC4899" } },
        `🕐 ${format(new Date(event.dateStart), "h:mm a")}${event.dateEnd ? ` - ${format(new Date(event.dateEnd), "h:mm a")}` : ""}`
      ),
      event.location
        ? h(
            "div",
            { style: { display: "flex", fontSize: "28px", color: "#a78bfa" } },
            `📍 ${event.location}`
          )
        : null
    )
  );
}

export async function generateEventImage(
  event: EventData,
  template: TemplateType
): Promise<Buffer> {
  const { width, height } = DIMENSIONS[template];

  let element: ReactNode;
  switch (template) {
    case "instagram_post":
      element = createInstagramPost(event);
      break;
    case "instagram_story":
      element = createInstagramStory(event);
      break;
    case "flyer":
      element = createFlyer(event);
      break;
  }

  const svg = await satori(element as React.ReactElement, {
    width,
    height,
    fonts: [
      { name: "Inter", data: interRegular, weight: 400, style: "normal" as const },
      { name: "Inter", data: interBold, weight: 700, style: "normal" as const },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width" as const, value: width },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
