"use client";

import { useState, useCallback, useRef } from "react";
import ChatPanel, { type UIMessage } from "@/components/ChatPanel";
import WorkspacePanel from "@/components/WorkspacePanel";
import StatusBar from "@/components/StatusBar";
import SettingsPanel from "@/components/SettingsPanel";
import type { AgentStep } from "@/lib/agentCore";

/* ═══════════════════════════════════════════
   HOME — 3-column IDE layout with lifted state
   
   State flow:
   - page.tsx owns messages[], agentSteps[], isBusy
   - ChatPanel renders messages + accepts onSend/onStop
   - WorkspacePanel consumes agentSteps for all 4 tabs
   - StatusBar consumes agentSteps for stats
   ═══════════════════════════════════════════ */

type View = "agent" | "settings";

export default function Home() {
    const [view, setView] = useState<View>("agent");
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [liveSteps, setLiveSteps] = useState<AgentStep[]>([]);
    const [allSteps, setAllSteps] = useState<AgentStep[]>([]);
    const [isBusy, setIsBusy] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const handleSend = useCallback(async (text: string) => {
        // Add user message
        const userMsg: UIMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: text,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setLiveSteps([]);
        setIsBusy(true);

        const controller = new AbortController();
        abortRef.current = controller;

        // Build conversation history for the agent
        const history = [...messages, userMsg].map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
        }));

        const sessionSteps: AgentStep[] = [];

        try {
            // Dynamic import to avoid SSR issues with server-only modules
            const { runAgent } = await import("@/lib/agentCore");

            await runAgent(
                text,
                history,
                "workspace",
                (step: AgentStep) => {
                    sessionSteps.push(step);
                    setLiveSteps([...sessionSteps]);
                    setAllSteps(prev => [...prev, step]);
                },
                controller.signal,
            );

            // Agent completed — extract final response
            const responseSteps = sessionSteps.filter(s => s.type === "response");
            const finalContent = responseSteps.length > 0
                ? responseSteps.map(s => s.content).join("\n\n")
                : sessionSteps.filter(s => s.type === "thinking").map(s => s.content).join("\n\n") || "Done.";

            const assistantMsg: UIMessage = {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                content: finalContent,
                timestamp: Date.now(),
                steps: sessionSteps,
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err) {
            if ((err as Error)?.name !== "AbortError") {
                const errorMsg: UIMessage = {
                    id: `error-${Date.now()}`,
                    role: "assistant",
                    content: `❌ Error: ${(err as Error)?.message || "Unknown error occurred"}`,
                    timestamp: Date.now(),
                    steps: sessionSteps,
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } finally {
            setIsBusy(false);
            setLiveSteps([]);
            abortRef.current = null;
        }
    }, [messages]);

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
        setIsBusy(false);
    }, []);

    return (
        <div className="app-layout">
            {/* ── Frosted Header ── */}
            <header className="app-header">
                <div className="logo">
                    <div className="logo-icon">⚡</div>
                    <span className="logo-text">ShellShockHive</span>
                </div>
                <div style={{ flex: 1 }} />
                <nav className="nav-group">
                    <button
                        className={`nav-btn ${view === "agent" ? "active" : ""}`}
                        onClick={() => setView("agent")}
                    >
                        ⚡ Agent
                    </button>
                    <button
                        className={`nav-btn ${view === "settings" ? "active" : ""}`}
                        onClick={() => setView("settings")}
                    >
                        ⚙️ Settings
                    </button>
                </nav>
            </header>

            {/* ── Glass Sidebar ── */}
            <aside className="app-sidebar">
                <div className="sidebar-section">
                    <div className="sidebar-label">Conversations</div>
                    <div className="sidebar-item active" style={{ marginTop: 4 }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span>New Chat</span>
                    </div>
                </div>

                {/* Show recent files modified by agent */}
                {allSteps.filter(s => s.type === "tool_call" && (s.toolName === "create_file" || s.toolName === "edit_file")).length > 0 && (
                    <div className="sidebar-section">
                        <div className="sidebar-label">Modified Files</div>
                        {allSteps
                            .filter(s => s.type === "tool_call" && (s.toolName === "create_file" || s.toolName === "edit_file"))
                            .slice(-8)
                            .map((s, i) => {
                                const filePath = (s.toolArgs?.path as string || s.toolArgs?.file_path as string || "").split("/").pop() || "file";
                                return (
                                    <div key={i} className="sidebar-item" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
                                        <span style={{ width: 15, textAlign: "center", fontSize: 10 }}>
                                            {s.toolName === "create_file" ? "+" : "~"}
                                        </span>
                                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {filePath}
                                        </span>
                                    </div>
                                );
                            })
                        }
                    </div>
                )}

                <div style={{ flex: 1 }} />
                <div className="sidebar-section" style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 12 }}>
                    <div className="sidebar-item" onClick={() => setView("settings")}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                        </svg>
                        <span>Settings</span>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="app-main">
                {view === "agent" && (
                    <ChatPanel
                        messages={messages}
                        onSend={handleSend}
                        isBusy={isBusy}
                        onStop={handleStop}
                        liveSteps={liveSteps}
                    />
                )}
                {view === "settings" && <SettingsPanel />}
            </main>

            {/* ── Workspace Panel (right side) ── */}
            {view === "agent" && (
                <WorkspacePanel steps={allSteps} isRunning={isBusy} />
            )}

            {/* Show spacer when settings view (workspace hidden) */}
            {view === "settings" && <div />}

            {/* ── Status Bar ── */}
            <StatusBar steps={allSteps} isRunning={isBusy} />
        </div>
    );
}
