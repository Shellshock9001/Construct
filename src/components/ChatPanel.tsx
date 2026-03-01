"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AgentStep } from "@/lib/agentCore";
import {
    IconZap, IconBrain, IconWrench, IconCheck, IconX,
    IconMessageSquare, IconXCircle, IconClipboard, IconPlay,
} from "./Icons";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

export interface UIMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    steps?: AgentStep[];
}

/* ═══════════════════════════════════════════
   CHAT PANEL — Unified Intelligence
   
   NO mode toggle. Every message goes through the
   agent which has full intelligence on every input.
   ═══════════════════════════════════════════ */

interface ChatPanelProps {
    messages: UIMessage[];
    onSend: (text: string) => void;
    isBusy: boolean;
    onStop: () => void;
    liveSteps: AgentStep[];
}

export default function ChatPanel({ messages, onSend, isBusy, onStop, liveSteps }: ChatPanelProps) {
    const [input, setInput] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, liveSteps]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "22px";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSend = useCallback(() => {
        const text = input.trim();
        if (!text || isBusy) return;
        onSend(text);
        setInput("");
    }, [input, isBusy, onSend]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    return (
        <div className="chat-container">
            {/* ── Messages ── */}
            <div className="chat-messages">
                {messages.length === 0 && !isBusy && (
                    <EmptyState onPrompt={(text) => { setInput(text); }} />
                )}

                {messages.map(msg => (
                    <MessageBubble key={msg.id} msg={msg} />
                ))}

                {/* Live agent working indicator */}
                {isBusy && (
                    <div className="chat-msg assistant animate-in">
                        <div className="chat-msg-avatar"><IconZap size={16} /></div>
                        <div className="chat-msg-content">
                            {liveSteps.length > 0 ? (
                                <LiveStepsPreview steps={liveSteps} />
                            ) : (
                                <ThinkingIndicator />
                            )}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* ── Input ── */}
            <div className="chat-input-container">
                <div className="chat-input-wrapper">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tell ShellShockHive what to build..."
                        rows={1}
                        disabled={isBusy}
                    />
                    {isBusy ? (
                        <button className="send-btn stop" onClick={onStop}><IconX size={14} /></button>
                    ) : (
                        <button className="send-btn primary" onClick={handleSend} disabled={!input.trim()}><IconPlay size={14} /></button>
                    )}
                </div>
                <div className="chat-input-hint">
                    Shift+Enter for new line · Every message uses full agent intelligence
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   MESSAGE BUBBLE
   ═══════════════════════════════════════════ */

function MessageBubble({ msg }: { msg: UIMessage }) {
    return (
        <div className={`chat-msg ${msg.role === "user" ? "user" : "assistant"} animate-in`}>
            <div className="chat-msg-avatar">
                {msg.role === "user"
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    : <IconZap size={16} />}
            </div>
            <div className="chat-msg-content">
                <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

                {msg.steps && msg.steps.length > 0 && (
                    <StepsAccordion steps={msg.steps} />
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   STEPS ACCORDION (completed messages)
   ═══════════════════════════════════════════ */

function StepsAccordion({ steps }: { steps: AgentStep[] }) {
    const [expanded, setExpanded] = useState(false);
    const toolCalls = steps.filter(s => s.type === "tool_call").length;

    return (
        <div className="agent-steps-container">
            <button className="agent-steps-toggle" onClick={() => setExpanded(!expanded)}>
                <span style={{ fontSize: 9, transition: "transform 0.2s", display: "inline-block", transform: expanded ? "rotate(90deg)" : "none" }}>▶</span>
                <span>{toolCalls} tool calls · {steps.length} total steps</span>
            </button>
            {expanded && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                    {steps.map((step, i) => (
                        <div key={step.id || i} className="agent-step-item" style={{
                            fontFamily: step.type === "tool_call" || step.type === "tool_result" ? "var(--font-mono)" : "inherit",
                            color: step.type === "error" ? "var(--accent-error)" :
                                step.type === "tool_call" ? "var(--accent-primary)" :
                                    step.toolResult?.success === false ? "var(--accent-error)" :
                                        step.toolResult?.success ? "var(--accent-success)" : "var(--text-secondary)",
                        }}>
                            <div className="agent-step-header">
                                <span>{stepIcon(step)}</span>
                                {step.toolName && <span style={{ fontWeight: 600 }}>{step.toolName}</span>}
                            </div>
                            {(step.type === "tool_result" || step.type === "response" || step.type === "error") && (
                                <div className="agent-step-body">
                                    {step.content.slice(0, 400)}
                                    {step.content.length > 400 && "..."}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   LIVE STEPS PREVIEW (while agent is working)
   ═══════════════════════════════════════════ */

function LiveStepsPreview({ steps }: { steps: AgentStep[] }) {
    const last = steps[steps.length - 1];
    const toolCalls = steps.filter(s => s.type === "tool_call").length;

    return (
        <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                <span className="thinking-dots"><span /><span /><span /></span> Working... ({toolCalls} tool calls)
            </div>
            {last && (
                <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>{stepIcon(last)}</span>
                    <span style={{ fontWeight: 500 }}>
                        {last.toolName || last.type}
                    </span>
                    {last.type === "tool_call" && last.toolArgs && (
                        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>
                            {Object.entries(last.toolArgs).map(([k, v]) =>
                                `${k}=${typeof v === "string" ? v.slice(0, 30) : "..."}`
                            ).join(", ")}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   UTILITIES
   ═══════════════════════════════════════════ */

function stepIcon(step: AgentStep): JSX.Element {
    switch (step.type) {
        case "thinking": return <IconBrain size={12} color="var(--accent-secondary)" />;
        case "tool_call": return <IconWrench size={12} color="var(--accent-primary)" />;
        case "tool_result": return step.toolResult?.success ? <IconCheck size={12} color="var(--accent-success)" /> : <IconX size={12} color="var(--accent-error)" />;
        case "response": return <IconMessageSquare size={12} color="var(--accent-primary)" />;
        case "error": return <IconXCircle size={12} color="var(--accent-error)" />;
        case "plan": return <IconClipboard size={12} color="var(--accent-secondary)" />;
        default: return <IconZap size={12} />;
    }
}

function ThinkingIndicator() {
    return (
        <div className="thinking-indicator">
            <div className="thinking-dots"><span /><span /><span /></div>
            Thinking...
        </div>
    );
}

function EmptyState({ onPrompt }: { onPrompt: (text: string) => void }) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon"><IconZap size={48} color="var(--accent-primary)" /></div>
            <div className="empty-state-title">ShellShockHive</div>
            <div className="empty-state-subtitle">
                Full-stack AI agent. Tell me what to build — I&apos;ll analyze it, research the architecture, and code it end-to-end with all my tools.
            </div>
            <div className="empty-state-prompts">
                {[
                    "Build a real-time chat app with WebSocket",
                    "Create a REST API with auth and database",
                    "Make a dashboard with live charts",
                    "Build an e-commerce storefront",
                ].map((prompt, i) => (
                    <button key={i} className="prompt-chip" onClick={() => onPrompt(prompt)}>
                        {prompt}
                    </button>
                ))}
            </div>
        </div>
    );
}

function renderMarkdown(text: string): string {
    return text
        .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
            `<div class="code-block"><div class="code-block-header"><span>${lang || "code"}</span></div><pre><code>${escapeHtml(code.trim())}</code></pre></div>`)
        .replace(/`([^`]+)`/g, "<code style='background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;border:1px solid var(--border-subtle);'>$1</code>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/^### (.*$)/gm, "<h3 style='font-size:14px;font-weight:700;margin:12px 0 4px;color:var(--text-primary);'>$1</h3>")
        .replace(/^## (.*$)/gm, "<h2 style='font-size:15px;font-weight:700;margin:14px 0 6px;color:var(--text-primary);'>$1</h2>")
        .replace(/^# (.*$)/gm, "<h1 style='font-size:17px;font-weight:800;margin:16px 0 6px;'>$1</h1>")
        .replace(/^- (.*$)/gm, "<div style='padding-left:14px;margin:2px 0;'>• $1</div>")
        .replace(/^\d+\. (.*$)/gm, "<div style='padding-left:14px;margin:2px 0;'>$1</div>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' target='_blank' style='color:var(--accent-primary);text-decoration:none;border-bottom:1px solid rgba(0,212,255,0.2);'>$1</a>")
        .replace(/\n\n/g, "<br/><br/>")
        .replace(/\n/g, "<br/>");
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
