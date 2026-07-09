"use client";

import { Bot, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DataMode } from "@/lib/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="ai-chat-md text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-zinc-900 dark:text-zinc-50">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => (
            <h1 className="mb-2 text-base font-semibold text-zinc-900 dark:text-zinc-50">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{children}</h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-abia underline underline-offset-2 hover:text-abia-dark"
            >
              {children}
            </a>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className="block overflow-x-auto rounded-lg bg-zinc-100 px-2.5 py-2 font-mono text-[12px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[12px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-2 overflow-x-auto last:mb-0">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="mb-2 border-l-2 border-zinc-300 pl-3 text-zinc-600 last:mb-0 dark:border-zinc-600 dark:text-zinc-300">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-left text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-zinc-200 dark:border-zinc-700">{children}</thead>,
          th: ({ children }) => (
            <th className="px-2 py-1.5 font-semibold text-zinc-900 dark:text-zinc-50">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-t border-zinc-100 px-2 py-1.5 dark:border-zinc-800">{children}</td>
          ),
          hr: () => <hr className="my-3 border-zinc-200 dark:border-zinc-700" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const SUGGESTIONS = [
  "What should the Governor know about Abia right now?",
  "Which sector needs the most attention?",
  "What data do we have for PHCs?",
  "Which LGAs are leading and which need support?",
];

export default function AiChatWidget({ mode }: { mode: DataMode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask me about the live dashboard data. I can brief you on sectors, LGAs, indicators, facilities and data gaps.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveOnly = mode !== "live";

  async function send(question?: string) {
    const text = (question ?? input).trim();
    if (!text || busy || liveOnly) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "AI assistant failed.");
      setMessages((current) => [...current, { role: "assistant", content: body.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI assistant failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-800 lg:bottom-6 lg:right-6"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
        AI assistant
      </button>

      {open && (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 lg:bottom-6 lg:right-6 lg:left-auto lg:mx-0 lg:w-[420px]">
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 bg-zinc-950 px-4 py-3 text-white">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 p-2">
                <Bot className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  Abia AI Assistant
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" strokeWidth={1.5} />
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                  Live-mode answers: Sector Dashboard first, then statewide, then entities.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Close AI assistant"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {liveOnly ? (
            <div className="p-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                The AI assistant only works in Live mode so it can answer from real dashboard data. Switch the data
                source to Live to use it.
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[420px] space-y-3 overflow-y-auto bg-zinc-50 px-4 py-4 dark:bg-zinc-950">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "ml-10 bg-zinc-950 text-white"
                        : "mr-8 border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <AssistantMarkdown content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                ))}
                {messages.length === 1 && (
                  <div className="grid gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-zinc-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                {busy && (
                  <div className="mr-8 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Thinking through the dashboard data...
                  </div>
                )}
              </div>

              {error && (
                <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  {error}
                </div>
              )}

              <form
                className="flex items-end gap-2 border-t border-zinc-100 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                onSubmit={(event) => {
                  event.preventDefault();
                  send();
                }}
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  placeholder="Ask about sectors, LGAs, PHCs, indicators..."
                  className="min-h-10 flex-1 resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-abia text-white transition hover:bg-abia-dark disabled:cursor-not-allowed disabled:bg-zinc-300"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
