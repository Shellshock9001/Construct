"use client";

import { useState, useEffect } from "react";
import type { AgentStep } from "@/lib/agentCore";
import { pool, type AgentSlot } from "@/lib/agentPool";
import { ledger, type LedgerEntry, type LedgerCostSummary } from "@/lib/orchestrationLedger";
import {
    IconActivity, IconTerminal, IconFolder, IconBot, IconBrain,
    IconWrench, IconSearch, IconCheck, IconCheckCircle, IconX, IconXCircle,
    IconAlertTriangle, IconMessageSquare, IconLightbulb, IconClipboard,
    IconBarChart, IconHash, IconTarget, IconShield, IconShieldCheck,
    IconUsers, IconZap, IconPlay, IconFileText, IconDollarSign,
    IconPause, IconFile,
} from "./Icons";

/* ═══════════════════════════════════════════
   WORKSPACE PANEL — Tabbed IDE right panel
   
   Tabs:
   - Activity: Live timeline of all agent actions
   - Terminal: Filtered terminal output from run_command
   - Files:   File tree from scan_project results
   - Agents:  Live agent slots, status, key rotation
   - Intel:   Intelligence dashboard with ledger, cost, validation
   ═══════════════════════════════════════════ */

interface WorkspacePanelProps {
    steps: AgentStep[];
    isRunning: boolean;
}

type Tab = "activity" | "terminal" | "files" | "agents" | "intel";

const TAB_ICONS: Record<Tab, (p: { size?: number; color?: string }) => JSX.Element> = {
    activity: (p) => <IconActivity {...p} />,
    terminal: (p) => <IconTerminal {...p} />,
    files: (p) => <IconFolder {...p} />,
    agents: (p) => <IconBot {...p} />,
    intel: (p) => <IconBrain {...p} />,
};

export default function WorkspacePanel({ steps, isRunning }: WorkspacePanelProps) {
    const [activeTab, setActiveTab] = useState<Tab>("activity");

    const toolCalls = steps.filter(s => s.type === "tool_call");
    const terminalSteps = steps.filter(
        s => s.type === "tool_result" && s.toolName === "run_command"
    );
    const fileSteps = steps.filter(
        s => s.type === "tool_result" && (s.toolName === "scan_project" || s.toolName === "list_directory")
    );
    const intelSteps = steps.filter(s => s.type === "thinking" || s.type === "plan");

    const tabs: { id: Tab; label: string; count?: number }[] = [
        { id: "activity", label: "Activity", count: steps.length },
        { id: "terminal", label: "Terminal", count: terminalSteps.length },
        { id: "files", label: "Files", count: fileSteps.length },
        { id: "agents", label: "Agents" },
        { id: "intel", label: "Intel", count: intelSteps.length },
    ];

    return (
        <div className="app-workspace">
            <div className="workspace-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`workspace-tab ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {TAB_ICONS[tab.id]({ size: 14 })}
                        {tab.label}
                        {(tab.count ?? 0) > 0 && (
                            <span className="workspace-tab-count">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className="workspace-content">
                {activeTab === "activity" && <ActivityTab steps={steps} isRunning={isRunning} />}
                {activeTab === "terminal" && <TerminalTab steps={terminalSteps} terminalCalls={toolCalls.filter(s => s.toolName === "run_command")} />}
                {activeTab === "files" && <FilesTab steps={steps} />}
                {activeTab === "agents" && <AgentsTab />}
                {activeTab === "intel" && <IntelTab steps={steps} />}
            </div>
        </div>
    );
}

/* ─── Activity Tab ─── */

function ActivityTab({ steps, isRunning }: { steps: AgentStep[]; isRunning: boolean }) {
    if (steps.length === 0) {
        return (
            <div className="workspace-empty">
                <div className="workspace-empty-icon"><IconActivity size={32} color="var(--text-muted)" /></div>
                <div>Agent activity will appear here</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>Send a message to start</div>
            </div>
        );
    }

    return (
        <div className="activity-feed">
            {steps.map((step, i) => (
                <ActivityItem key={step.id || i} step={step} />
            ))}
            {isRunning && (
                <div className="activity-item">
                    <div className="activity-icon thinking">
                        <span style={{ animation: "thinking-pulse 1.4s infinite" }}>
                            <IconZap size={14} color="var(--accent-primary)" />
                        </span>
                    </div>
                    <div className="activity-body">
                        <div className="activity-title" style={{ color: "var(--accent-primary)" }}>Working...</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StepIcon({ type, success }: { type: AgentStep["type"]; success?: boolean }) {
    switch (type) {
        case "thinking": return <IconBrain size={14} color="var(--accent-secondary)" />;
        case "tool_call": return <IconWrench size={14} color="var(--accent-primary)" />;
        case "tool_result": return success ? <IconCheck size={14} color="var(--accent-success)" /> : <IconX size={14} color="var(--accent-error)" />;
        case "response": return <IconMessageSquare size={14} color="var(--accent-primary)" />;
        case "error": return <IconXCircle size={14} color="var(--accent-error)" />;
        case "plan": return <IconClipboard size={14} color="var(--accent-secondary)" />;
        default: return <IconZap size={14} />;
    }
}

function ActivityItem({ step }: { step: AgentStep }) {
    const labels: Record<AgentStep["type"], string> = {
        thinking: "Thinking",
        tool_call: step.toolName || "Tool",
        tool_result: step.toolName || "Result",
        response: "Response",
        error: "Error",
        plan: "Plan",
    };
    const iconClasses: Record<AgentStep["type"], string> = {
        thinking: "thinking", tool_call: "tool",
        tool_result: step.toolResult?.success ? "success" : "error",
        response: "response", error: "error", plan: "thinking",
    };

    const time = new Date(step.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

    let detail = "";
    if (step.type === "tool_call" && step.toolArgs) {
        const args = Object.entries(step.toolArgs)
            .map(([k, v]) => `${k}=${typeof v === "string" ? v.slice(0, 40) : JSON.stringify(v)?.slice(0, 30)}`)
            .join(", ");
        detail = args;
    } else if (step.content) {
        detail = step.content.slice(0, 80);
    }

    return (
        <div className="activity-item animate-in">
            <div className={`activity-icon ${iconClasses[step.type]}`}>
                <StepIcon type={step.type} success={step.toolResult?.success} />
            </div>
            <div className="activity-body">
                <div className="activity-title">{labels[step.type]}</div>
                {detail && <div className="activity-detail">{detail}</div>}
            </div>
            <span className="activity-time">{time}</span>
        </div>
    );
}

/* ─── Terminal Tab ─── */

function TerminalTab({ steps, terminalCalls }: { steps: AgentStep[]; terminalCalls: AgentStep[] }) {
    if (steps.length === 0 && terminalCalls.length === 0) {
        return (
            <div className="workspace-empty">
                <div className="workspace-empty-icon"><IconTerminal size={32} color="var(--text-muted)" /></div>
                <div>Terminal output appears here</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>When the agent runs commands</div>
            </div>
        );
    }

    return (
        <div className="terminal-output">
            {terminalCalls.map((call, i) => {
                const cmd = call.toolArgs?.command as string || "unknown";
                const result = steps[i];
                return (
                    <div key={call.id || i} style={{ marginBottom: 12 }}>
                        <div className="cmd">$ {cmd}</div>
                        {result && (
                            <div className={result.toolResult?.success ? "stdout" : "stderr"}>
                                {result.content.slice(0, 2000)}
                                {result.content.length > 2000 && "\n... (truncated)"}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Files Tab ─── */

function FilesTab({ steps }: { steps: AgentStep[] }) {
    const fileActions = steps.filter(
        s => s.type === "tool_call" && (
            s.toolName === "create_file" || s.toolName === "edit_file" ||
            s.toolName === "delete_file" || s.toolName === "read_file"
        )
    );
    const scanResults = steps.filter(
        s => s.type === "tool_result" && (s.toolName === "scan_project" || s.toolName === "list_directory")
    );

    if (fileActions.length === 0 && scanResults.length === 0) {
        return (
            <div className="workspace-empty">
                <div className="workspace-empty-icon"><IconFolder size={32} color="var(--text-muted)" /></div>
                <div>Project files appear here</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>When the agent creates or scans files</div>
            </div>
        );
    }

    const files = new Map<string, { action: string; path: string }>();
    for (const step of fileActions) {
        const p = step.toolArgs?.path as string || step.toolArgs?.file_path as string || "unknown";
        const action = step.toolName === "create_file" ? "new"
            : step.toolName === "edit_file" ? "modified"
                : step.toolName === "delete_file" ? "deleted" : "read";
        files.set(p, { action, path: p });
    }

    return (
        <div className="file-tree">
            {Array.from(files.values()).map((f, i) => (
                <div key={i} className={`file-tree-item ${f.action === "new" ? "new" : f.action === "modified" ? "modified" : ""}`}>
                    <span className="file-tree-icon">
                        {f.action === "new" ? "+" : f.action === "modified" ? "~" : f.action === "deleted" ? "\u2212" : "\u00b7"}
                    </span>
                    <span>{f.path}</span>
                    <span className={`badge ${f.action === "new" ? "badge-success" : f.action === "modified" ? "badge-warning" : "badge-error"}`}
                        style={{ fontSize: 9, padding: "1px 6px", marginLeft: "auto" }}>
                        {f.action}
                    </span>
                </div>
            ))}
            {scanResults.length > 0 && (
                <div style={{ marginTop: 12, padding: 8, background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)", fontSize: 10, color: "var(--text-muted)" }}>
                    {scanResults[scanResults.length - 1].content.slice(0, 1000)}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   AGENTS TAB — Live agent slots dashboard
   ═══════════════════════════════════════════ */

function AgentsTab() {
    const [slots, setSlots] = useState<readonly AgentSlot[]>([]);
    const [cost, setCost] = useState<LedgerCostSummary>({ totalTokens: 0, estimatedUsd: 0, byAgent: {} });

    useEffect(() => {
        pool.rebuild();
        setSlots(pool.getSlots());
        setCost(ledger.getCost());
        const unsub = ledger.subscribe(() => {
            setSlots(pool.getSlots());
            setCost(ledger.getCost());
        });
        const interval = setInterval(() => {
            setSlots(pool.getSlots());
            setCost(ledger.getCost());
        }, 2000);
        return () => { unsub(); clearInterval(interval); };
    }, []);

    if (slots.length === 0) {
        return (
            <div className="workspace-empty">
                <div className="workspace-empty-icon"><IconBot size={32} color="var(--text-muted)" /></div>
                <div>No agent slots configured</div>
                <div style={{ fontSize: 10, opacity: 0.6 }}>Add API keys in Settings to activate agents</div>
            </div>
        );
    }

    const multiAgent = slots.length > 1;

    return (
        <div style={{ padding: 0 }}>
            <div style={{
                padding: "10px 12px",
                background: multiAgent
                    ? "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(34,197,94,0.1))"
                    : "rgba(0,0,0,0.1)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: multiAgent ? "var(--accent-primary)" : "var(--text-muted)" }}>
                        <IconUsers size={14} />{multiAgent ? "Multi-Agent Active" : "Solo Agent"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        {slots.length} slot{slots.length !== 1 ? "s" : ""} · {slots.filter(s => s.status === "idle").length} idle · {slots.filter(s => s.status === "busy").length} busy
                    </div>
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, color: "var(--accent-success)", fontFamily: "var(--font-mono)" }}>
                        <IconDollarSign size={14} />{cost.estimatedUsd.toFixed(4)}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-muted)" }}>{cost.totalTokens.toLocaleString()} tokens</div>
                </div>
            </div>
            <div style={{ padding: 8 }}>
                {slots.map(slot => (
                    <AgentSlotCard key={slot.id} slot={slot} agentCost={cost.byAgent[slot.id]} />
                ))}
            </div>
        </div>
    );
}

const STATUS_CONFIG: Record<AgentSlot["status"], { color: string; label: string; pulse: boolean }> = {
    idle: { color: "#22c55e", label: "Ready", pulse: false },
    busy: { color: "#f59e0b", label: "Working", pulse: true },
    cooldown: { color: "#6366f1", label: "Cooldown", pulse: true },
    error: { color: "#ef4444", label: "Error", pulse: false },
};

const ROLE_COLORS: Record<string, string> = {
    primary: "#4285f4", research: "#22c55e", validator: "#a855f7", general: "#64748b",
};

function AgentSlotCard({ slot, agentCost }: { slot: AgentSlot; agentCost?: { tokens: number; usd: number } }) {
    const status = STATUS_CONFIG[slot.status];
    const roleColor = ROLE_COLORS[slot.role] || ROLE_COLORS.general;

    return (
        <div style={{
            padding: "10px 12px", background: "var(--bg-primary)",
            border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-md)",
            marginBottom: 6, borderLeft: `3px solid ${status.color}`, transition: "all 0.3s ease",
        }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                        width: 8, height: 8, borderRadius: "50%", background: status.color,
                        display: "inline-block",
                        animation: status.pulse ? "thinking-pulse 1.4s infinite" : "none",
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{slot.id}</span>
                    <span style={{
                        fontSize: 9, padding: "1px 6px", borderRadius: 9999,
                        background: `${roleColor}20`, color: roleColor,
                        fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                    }}>{slot.role}</span>
                </div>
                <span style={{ fontSize: 10, color: status.color, fontWeight: 500 }}>{status.label}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                {slot.provider} · Key: ····{slot.apiKey.slice(-4)}
            </div>
            {slot.currentTask && (
                <div style={{
                    fontSize: 10, color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 6px", background: "rgba(99,102,241,0.1)",
                    borderRadius: "var(--radius-sm)", marginBottom: 4,
                }}>
                    <IconTarget size={10} /> {slot.currentTask}
                </div>
            )}
            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-muted)", alignItems: "center" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><IconBarChart size={10} /> {slot.stats.totalCalls} calls</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><IconHash size={10} /> {slot.stats.totalTokens.toLocaleString()} tok</span>
                {slot.stats.errorsThisSession > 0 && (
                    <span style={{ color: "var(--accent-error)", display: "flex", alignItems: "center", gap: 3 }}>
                        <IconAlertTriangle size={10} /> {slot.stats.errorsThisSession} err
                    </span>
                )}
                {agentCost && (
                    <span style={{ color: "var(--accent-success)", marginLeft: "auto", fontFamily: "var(--font-mono)" }}>
                        ${agentCost.usd.toFixed(4)}
                    </span>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   INTEL TAB — Full Intelligence Dashboard
   ═══════════════════════════════════════════ */

function IntelTab({ steps }: { steps: AgentStep[] }) {
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [cost, setCost] = useState<LedgerCostSummary>({ totalTokens: 0, estimatedUsd: 0, byAgent: {} });

    useEffect(() => {
        setEntries(ledger.getRecent(50));
        setCost(ledger.getCost());
        const unsub = ledger.subscribe(() => {
            setEntries(ledger.getRecent(50));
            setCost(ledger.getCost());
        });
        const interval = setInterval(() => {
            setEntries(ledger.getRecent(50));
            setCost(ledger.getCost());
        }, 2000);
        return () => { unsub(); clearInterval(interval); };
    }, []);

    const thinkingSteps = steps.filter(s => s.type === "thinking");
    const planSteps = steps.filter(s => s.type === "plan");
    const responseSteps = steps.filter(s => s.type === "response");
    const blueprintStep = responseSteps.find(s => s.content.includes("App Blueprint"));
    const confidenceMatch = blueprintStep?.content.match(/Confidence:\s*(\d+)%/);
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 0;
    const researchCount = entries.filter(e => e.type === "research_complete").length;
    const cacheHits = entries.filter(e => e.type === "research_complete" && e.agentId === "cache").length;
    const validations = entries.filter(e => e.type === "validation_complete");
    const validationsPassed = validations.filter(e => { const p = e.payload as any; return p?.valid === true; }).length;
    const insights = entries.filter(e => e.type === "insight_shared");

    return (
        <div>
            {/* Performance header */}
            <div style={{
                padding: "12px",
                background: "linear-gradient(135deg, rgba(16,163,127,0.1), rgba(99,102,241,0.05))",
                borderBottom: "1px solid var(--border-subtle)",
            }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                    <MiniStat icon={<IconDollarSign size={12} />} label="Cost" value={`$${cost.estimatedUsd.toFixed(4)}`} color="var(--accent-success)" />
                    <MiniStat icon={<IconHash size={12} />} label="Tokens" value={cost.totalTokens.toLocaleString()} color="var(--accent-primary)" />
                    <MiniStat icon={<IconSearch size={12} />} label="Research" value={String(researchCount)} sub={cacheHits > 0 ? `${cacheHits} cached` : undefined} color="#f59e0b" />
                    <MiniStat icon={<IconShieldCheck size={12} />} label="Validated" value={`${validationsPassed}/${validations.length}`} color="#a855f7" />
                </div>
            </div>

            {confidence > 0 && (
                <div className="intel-section">
                    <div className="intel-label">Agent Confidence</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div className="intel-bar" style={{ flex: 1 }}>
                            <div className="intel-bar-fill" style={{ width: `${confidence}%` }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: confidence > 70 ? "var(--accent-success)" : confidence > 40 ? "var(--accent-warning)" : "var(--accent-error)" }}>
                            {confidence}%
                        </span>
                    </div>
                </div>
            )}

            {validations.length > 0 && (
                <div className="intel-section">
                    <div className="intel-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <IconShield size={12} /> Cross-Validation ({validations.length})
                    </div>
                    {validations.slice(-5).map((v, i) => {
                        const p = v.payload as any;
                        const passed = p?.valid !== false;
                        const issueCount = Array.isArray(p?.issues) ? p.issues.length : 0;
                        return (
                            <div key={i} style={{
                                padding: "6px 8px", marginBottom: 4,
                                background: passed ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                                borderRadius: "var(--radius-sm)",
                                borderLeft: `2px solid ${passed ? "#22c55e" : "#ef4444"}`, fontSize: 11,
                            }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: 600, color: passed ? "#22c55e" : "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                                        {passed ? <><IconCheckCircle size={12} /> PASS</> : <><IconAlertTriangle size={12} /> {issueCount} issue{issueCount !== 1 ? "s" : ""}</>}
                                    </span>
                                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{v.agentId}</span>
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{v.topic.slice(0, 80)}</div>
                            </div>
                        );
                    })}
                </div>
            )}

            {insights.length > 0 && (
                <div className="intel-section">
                    <div className="intel-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <IconLightbulb size={12} /> Shared Insights ({insights.length})
                    </div>
                    {insights.slice(-5).map((ins, i) => (
                        <div key={i} style={{
                            padding: "6px 8px", marginBottom: 4,
                            background: "rgba(245,158,11,0.08)", borderRadius: "var(--radius-sm)",
                            borderLeft: "2px solid #f59e0b", fontSize: 10, color: "var(--text-secondary)",
                        }}>
                            {String(ins.payload).slice(0, 150)}
                        </div>
                    ))}
                </div>
            )}

            {entries.length > 0 && (
                <div className="intel-section">
                    <div className="intel-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <IconClipboard size={12} /> Ledger Stream ({entries.length} events)
                    </div>
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                        {entries.slice(-15).reverse().map((entry, i) => (
                            <LedgerRow key={entry.id || i} entry={entry} />
                        ))}
                    </div>
                </div>
            )}

            {blueprintStep && (
                <div className="intel-section">
                    <div className="intel-label">Blueprint</div>
                    <div className="intel-value">{blueprintStep.content}</div>
                </div>
            )}

            {thinkingSteps.length > 0 && (
                <div className="intel-section">
                    <div className="intel-label">Reasoning ({thinkingSteps.length} steps)</div>
                    {thinkingSteps.slice(-5).map((s, i) => (
                        <div key={i} className="intel-value" style={{ marginBottom: 6, padding: "6px 8px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-sm)", fontSize: 11 }}>
                            {s.content.slice(0, 200)}{s.content.length > 200 && "..."}
                        </div>
                    ))}
                </div>
            )}

            {planSteps.length > 0 && (
                <div className="intel-section">
                    <div className="intel-label">Plans</div>
                    {planSteps.map((s, i) => (
                        <div key={i} className="intel-value" style={{ marginBottom: 6 }}>{s.content.slice(0, 300)}</div>
                    ))}
                </div>
            )}

            <div className="intel-section">
                <div className="intel-label">Session Stats</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <StatCard label="Tool Calls" value={steps.filter(s => s.type === "tool_call").length} color="var(--accent-primary)" />
                    <StatCard label="Successes" value={steps.filter(s => s.type === "tool_result" && s.toolResult?.success).length} color="var(--accent-success)" />
                    <StatCard label="Errors" value={steps.filter(s => s.type === "error" || (s.type === "tool_result" && !s.toolResult?.success)).length} color="var(--accent-error)" />
                    <StatCard label="Thinking" value={thinkingSteps.length} color="var(--accent-secondary)" />
                </div>
            </div>
        </div>
    );
}

/* ─── Ledger Row ─── */

function LedgerIcon({ type }: { type: string }) {
    switch (type) {
        case "research_started": return <IconSearch size={12} color="#f59e0b" />;
        case "research_complete": return <IconCheckCircle size={12} color="#22c55e" />;
        case "research_failed": return <IconXCircle size={12} color="#ef4444" />;
        case "validation_started": return <IconSearch size={12} color="#a855f7" />;
        case "validation_complete": return <IconShieldCheck size={12} color="#a855f7" />;
        case "code_generated": return <IconFileText size={12} color="#6366f1" />;
        case "code_validated": return <IconCheck size={12} color="#22c55e" />;
        case "tool_called": return <IconWrench size={12} />;
        case "tool_result": return <IconClipboard size={12} />;
        case "insight_shared": return <IconLightbulb size={12} color="#f59e0b" />;
        case "agent_assigned": return <IconBot size={12} color="#6366f1" />;
        case "agent_released": return <IconPause size={12} />;
        default: return <IconZap size={12} />;
    }
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
    const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const costStr = entry.cost ? ` · $${entry.cost.estimatedUsd.toFixed(4)}` : "";

    return (
        <div style={{
            padding: "4px 6px", fontSize: 10, display: "flex",
            alignItems: "flex-start", gap: 6,
            borderBottom: "1px solid rgba(255,255,255,0.03)", color: "var(--text-muted)",
        }}>
            <span style={{ minWidth: 16, textAlign: "center" }}><LedgerIcon type={entry.type} /></span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>{entry.agentId}</span>
                {" \u2192 "}
                {entry.topic.slice(0, 50)}{entry.topic.length > 50 && "..."}
                {costStr && <span style={{ color: "var(--accent-success)" }}>{costStr}</span>}
            </span>
            <span style={{ fontSize: 9, opacity: 0.5, minWidth: 55, textAlign: "right" }}>{time}</span>
        </div>
    );
}

/* ─── Stat Components ─── */

function MiniStat({ icon, label, value, color, sub }: { icon: JSX.Element; label: string; value: string; color: string; sub?: string }) {
    return (
        <div style={{ padding: "6px 8px", background: "rgba(0,0,0,0.15)", borderRadius: "var(--radius-sm)", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {icon}{value}
            </div>
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{label}</div>
            {sub && <div style={{ fontSize: 8, color, opacity: 0.7, marginTop: 1 }}>{sub}</div>}
        </div>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div style={{
            padding: "8px 10px", background: "rgba(0,0,0,0.2)",
            borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)",
        }}>
            <div style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 1 }}>{label}</div>
        </div>
    );
}
