"use client";

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { Role } from "@prisma/client";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type PendingAction = { actionId: string; tool: string; prompt: string };

const SUGGESTIONS: Record<string, string[]> = {
  FARMER: [
    "What is today's tomato price near me?",
    "Should I sell my 1,200 kg tomato today?",
    "Which market gives the best net price?",
    "Show my order status",
    "When will I receive my payment?",
  ],
  FPO: [
    "What is the onion price trend?",
    "Forecast chilli prices for the next week",
    "Find buyers for our 8,400 kg onion lot",
    "Show pending payments of our members",
  ],
  BUYER: [
    "Find lots of Grade A tomato below ₹32/kg",
    "What is my payment status?",
    "I need 2,000 kg Grade A tomato in Bengaluru",
    "Show my open orders",
  ],
  TRANSPORTER: ["Show open pickup jobs", "Which orders are assigned to me?"],
  ADMIN: ["Market data freshness", "Open disputes", "Verification queue"],
};

export function ChatClient({ userName, role, initial }: { userName: string; role: Role; initial: Msg[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text?: string, decision?: { confirm?: string; cancel?: string }) => {
    if (busy) return;
    const message = text ?? input.trim();
    if (!message && !decision) return;
    if (message) {
      setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", content: message }]);
      setInput("");
    }
    setBusy(true);
    setPending(null);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || undefined,
          sessionId,
          ...(decision?.confirm ? { confirmActionId: decision.confirm } : {}),
          ...(decision?.cancel ? { cancelActionId: decision.cancel } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMsgs((m) => [...m, { id: `e${Date.now()}`, role: "assistant", content: j.message || "Something went wrong." }]);
        return;
      }
      if (j.sessionId) setSessionId(j.sessionId);
      setMsgs((m) => [...m, { id: `a${Date.now()}`, role: "assistant", content: j.reply }]);
      if (j.pendingAction) {
        setPending({ actionId: j.pendingAction.actionId, tool: j.pendingAction.tool, prompt: j.pendingAction.prompt });
      }
    } catch {
      setMsgs((m) => [...m, { id: `e${Date.now()}`, role: "assistant", content: "Network error — check that the server is running." }]);
    } finally {
      setBusy(false);
    }
  };

  const chips = SUGGESTIONS[role] ?? SUGGESTIONS.FARMER;

  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -mt-5 sm:-mt-6 h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-8rem)]">
      {/* header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-3 bg-card border-b border-line/10">
        <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
          <Icon name="cpu" className="w-5 h-5" />
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink leading-tight">AgriLink Assistant</p>
          <p className="text-xs text-ink-muted truncate">
            {role === Role.BUYER ? "Sourcing copilot — connected to platform data" : "Selling copilot — connected to platform data"}
          </p>
        </div>
        <span className="badge bg-emerald-50 text-emerald-700 hidden sm:inline-flex">● Live data</span>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
        {msgs.length === 0 ? (
          <div className="text-center pt-6">
            <p className="font-semibold text-ink">Namaste {userName.split(" ")[0]} 🙏</p>
            <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
              Ask me anything about market prices, forecasts, buyers, your orders and payments. I answer only from real platform data — I never invent prices or status.
            </p>
          </div>
        ) : null}

        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-brand-600 text-white px-4 py-2.5 text-sm whitespace-pre-line shadow-sm">
                {m.content}
              </div>
            </div>
          ) : (
            <div key={m.id} className="flex justify-start gap-2">
              <span className="h-8 w-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="cpu" className="w-4 h-4" />
              </span>
              <div className="max-w-[85%] sm:max-w-[78%] rounded-2xl rounded-bl-md bg-card border border-line/10 px-4 py-2.5 text-sm text-ink whitespace-pre-line shadow-sm">
                {m.content}
              </div>
            </div>
          )
        )}

        {pending ? (
          <div className="flex justify-start gap-2">
            <span className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Icon name="shield" className="w-4 h-4" />
            </span>
            <div className="rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5">
                <Icon name="check" className="w-4 h-4" /> Confirm this action
              </p>
              <p className="text-xs text-amber-800/80 mt-1">
                {pending.tool.replaceAll("_", " ")} — {pending.prompt}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => send(undefined, { confirm: pending.actionId })}
                  disabled={busy}
                  className="btn-primary !py-1.5 !px-4 !min-h-0 text-xs"
                >
                  ✓ Confirm
                </button>
                <button
                  onClick={() => send(undefined, { cancel: pending.actionId })}
                  disabled={busy}
                  className="btn-ghost !py-1.5 !px-4 !min-h-0 text-xs text-amber-900 border border-amber-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {busy ? (
          <div className="flex justify-start gap-2">
            <span className="h-8 w-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center">
              <Icon name="cpu" className="w-4 h-4" />
            </span>
            <div className="rounded-2xl rounded-bl-md bg-card border border-line/10 px-4 py-3 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce" />
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.12s]" />
              <span className="h-2 w-2 rounded-full bg-brand-500 animate-bounce [animation-delay:0.24s]" />
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {/* suggestion chips */}
      <div className="px-4 sm:px-6 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
        {chips.map((c) => (
          <button
            key={c}
            onClick={() => send(c)}
            disabled={busy}
            className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-brand-100 disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="px-4 sm:px-6 pb-3 pt-1"
      >
        <div className="flex items-end gap-2 rounded-2xl bg-card border border-line/15 p-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/40">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={'Ask: \"what is today\'s tomato price?\" or \"arrange pickup for AG-1001\"'}
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none max-h-28"
          />
          <button type="submit" disabled={busy || (!input.trim() && !pending)} aria-label="Send" className="h-10 w-10 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-700 disabled:opacity-40 shrink-0">
            <Icon name="send" className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-ink-faint text-center mt-1.5">
          Actions (create lot, offers, pickup, disputes) always ask for your confirmation first · Answers come from live platform data
        </p>
      </form>
    </div>
  );
}