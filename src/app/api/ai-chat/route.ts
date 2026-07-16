import { NextRequest, NextResponse } from "next/server";
import { buildAssistantContext } from "@/lib/ai-assistant";
import { loadDashboardData } from "@/lib/datasource";

export const runtime = "nodejs";

const PWA_ORIGIN = (process.env.NEXT_PUBLIC_PWA_URL || "https://pwa-dashboard.abiaworkspace.com").replace(/\/$/, "");
const LOCAL_PWA_ORIGINS = (process.env.PWA_LOCAL_ORIGINS || process.env.PWA_LOCAL_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const isLanPwa = Boolean(origin && /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/.test(origin));
  const isLocalPwa =
    process.env.NODE_ENV !== "production" &&
    Boolean(
      origin &&
        (LOCAL_PWA_ORIGINS.includes(origin) ||
          /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin) ||
          isLanPwa)
    );

  if (!origin || (origin !== PWA_ORIGIN && !isLocalPwa)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function json(req: NextRequest, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders(req) });
}

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
      return { role, content: content.slice(0, 2000) };
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-8);
}

function latestUserQuestion(messages: ChatMessage[]): string | null {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() || null;
}

function geminiText(data: unknown): string {
  const candidates = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }).candidates;
  return candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const data = await loadDashboardData();
  if (data.mode !== "live") {
    return json(req, { error: "The AI assistant is only available in Live mode." }, 403);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(req, { error: "GEMINI_API_KEY is not configured in the web app environment." }, 503);
  }

  const body = await req.json().catch(() => null);
  const messages = cleanMessages(body?.messages);
  const question = latestUserQuestion(messages);
  if (!question) {
    return json(req, { error: "Ask a question first." }, 400);
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const context = buildAssistantContext(data, question);
  const conversation = messages
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n");

  const prompt = `Question:\n${question}\n\nRecent conversation:\n${conversation}\n\nAvailable dashboard context from local skills/topics/tools:\n${JSON.stringify(context, null, 2)}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are the Abia State Dashboard AI assistant. Answer like a concise executive data aide for the Governor. " +
                "Data lookup priority is mandatory: (1) Sector Dashboard executive indicators first, " +
                "(2) other statewide indicator results only if Sector Dashboard has no matching reading, " +
                "(3) entity-based facility/school/project records last. " +
                "When Sector Dashboard has a filled value, prefer it and say it comes from the Sector Dashboard. " +
                "If Sector Dashboard has the indicator but it is blank, say so before falling back. " +
                "Use only the supplied dashboard context from skills, topics and tools. Do not invent figures, sources or records. " +
                "If the requested data is absent at every layer, say it is not available yet and name the Sector Dashboard datapoint to add first. " +
                "Prefer short markdown: bullets, **bold** for key figures, and plain headings when useful. " +
                "Prefer bullets for multi-part answers, keep numbers grounded, and mention when a figure is a score, count, result or coverage split.",
            },
          ],
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 900,
        },
      }),
    }
  );

  if (!res.ok) {
    const message = await res.text();
    return json(req, { error: `Gemini request failed for ${model}: ${message}` }, 502);
  }

  const result = await res.json();
  const answer = geminiText(result);
  if (!answer) {
    return json(req, { error: "Gemini returned an empty answer." }, 502);
  }

  return json(req, {
    answer,
    model,
    topics: context.selectedTopics,
  });
}
