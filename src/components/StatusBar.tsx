"use client";

import { useState, useEffect } from "react";
import {
    type ProviderName,
    getProviderConfig,
    getSelectedModel,
} from "@/lib/providers";
import type { AgentStep } from "@/lib/agentCore";

/* ═══════════════════════════════════════════
   STATUS BAR — Bottom IDE status bar
   Shows provider, agent status, session stats
   ═══════════════════════════════════════════ */

interface StatusBarProps {
    steps: AgentStep[];
    isRunning: boolean;
}

export default function StatusBar({ steps, isRunning }: StatusBarProps) {
    /* Defer localStorage reads to avoid SSR hydration mismatch */
    const [providerLabel, setProviderLabel] = useState("");

    useEffect(() => {
        const info = getActiveProvider();
        if (info) {
            setProviderLabel(`${info.provider} · ${info.model}`);
        } else {
            setProviderLabel("No provider");
        }
    }, []);

    const toolCalls = steps.filter(s => s.type === "tool_call").length;
    const errors = steps.filter(s => s.type === "error" || (s.type === "tool_result" && !s.toolResult?.success)).length;
    const filesCreated = steps.filter(s => s.type === "tool_call" && s.toolName === "create_file").length;
    const filesEdited = steps.filter(s => s.type === "tool_call" && s.toolName === "edit_file").length;

    return (
        <footer className="app-statusbar">
            <div className="statusbar-section">
                {/* Provider indicator */}
                <div className="statusbar-item">
                    <span className={`status-dot ${providerLabel && providerLabel !== "No provider" ? "online" : "offline"}`} />
                    <span>{providerLabel}</span>
                </div>

                <div className="statusbar-divider" />

                {/* Agent status */}
                <div className="statusbar-item">
                    {isRunning ? (
                        <>
                            <span className="status-dot busy" />
                            <span style={{ color: "var(--accent-warning)" }}>Agent running</span>
                        </>
                    ) : (
                        <span>Ready</span>
                    )}
                </div>
            </div>

            <div className="statusbar-section">
                {toolCalls > 0 && (
                    <>
                        <div className="statusbar-item">
                            🔧 {toolCalls} tools
                        </div>
                        <div className="statusbar-divider" />
                    </>
                )}
                {(filesCreated > 0 || filesEdited > 0) && (
                    <>
                        <div className="statusbar-item">
                            📄 {filesCreated} created · {filesEdited} edited
                        </div>
                        <div className="statusbar-divider" />
                    </>
                )}
                {errors > 0 && (
                    <>
                        <div className="statusbar-item" style={{ color: "var(--accent-error)" }}>
                            ⚠ {errors} errors
                        </div>
                        <div className="statusbar-divider" />
                    </>
                )}
                <div className="statusbar-item">
                    ShellShockHive v1.0
                </div>
            </div>
        </footer>
    );
}

/* ─── Helper ─── */

function getActiveProvider(): { provider: ProviderName; model: string } | null {
    if (typeof window === "undefined") return null;
    const order: ProviderName[] = ["ollama", "groq", "openrouter", "openai", "anthropic"];
    for (const p of order) {
        const config = getProviderConfig(p);
        if (p === "ollama" || config.apiKey) {
            return { provider: p, model: getSelectedModel(p) };
        }
    }
    return null;
}
