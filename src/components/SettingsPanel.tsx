"use client";

import { useState, useEffect, useCallback } from "react";
import {
    type ProviderName,
    type ProviderStatus,
    type ModelInfo,
    getProviderConfig,
    setProviderConfig,
    getSelectedModel,
    setSelectedModel,
    validateProvider,
    OPENAI_MODELS,
    ANTHROPIC_MODELS,
    GROQ_MODELS,
    OPENROUTER_MODELS,
    GEMINI_MODELS,
    listOllamaModels,
    listGeminiModels,
    pullOllamaModel,
} from "@/lib/providers";
import {
    type RouterSettings,
    type TaskType,
    getRouterSettings,
    saveRouterSettings,
    getTaskTypeLabel,
    getTaskTypeDescription,
} from "@/lib/taskRouter";

/* ═══════════════════════════════════════════
   PROVIDER DEFINITIONS
   ═══════════════════════════════════════════ */

interface ProviderDef {
    id: ProviderName;
    label: string;
    description: string;
    icon: string;
    color: string;
    glowColor: string;
    placeholder: string;
    getKeyUrl: string;
    hasApiKey: boolean;
    hasModels: boolean;
}

const PROVIDERS: ProviderDef[] = [
    {
        id: "ollama",
        label: "Ollama",
        description: "Local models — llama3, qwen2.5-coder, deepseek",
        icon: "🦙",
        color: "#f59e0b",
        glowColor: "rgba(245, 158, 11, 0.2)",
        placeholder: "http://localhost:11434",
        getKeyUrl: "https://ollama.com/download",
        hasApiKey: false,
        hasModels: true,
    },
    {
        id: "groq",
        label: "Groq",
        description: "Free LPU inference — Llama 3.3 70B, DeepSeek R1",
        icon: "⚡",
        color: "#22c55e",
        glowColor: "rgba(34, 197, 94, 0.2)",
        placeholder: "gsk_...",
        getKeyUrl: "https://console.groq.com/keys",
        hasApiKey: true,
        hasModels: true,
    },
    {
        id: "openrouter",
        label: "OpenRouter",
        description: "Free models — DeepSeek V3, Qwen3 Coder, 300+",
        icon: "🔀",
        color: "#6366f1",
        glowColor: "rgba(99, 102, 241, 0.2)",
        placeholder: "sk-or-...",
        getKeyUrl: "https://openrouter.ai/keys",
        hasApiKey: true,
        hasModels: true,
    },
    {
        id: "openai",
        label: "OpenAI",
        description: "GPT-4o, o1, o3-mini — cloud intelligence",
        icon: "🧠",
        color: "#10a37f",
        glowColor: "rgba(16, 163, 127, 0.2)",
        placeholder: "sk-...",
        getKeyUrl: "https://platform.openai.com/api-keys",
        hasApiKey: true,
        hasModels: true,
    },
    {
        id: "anthropic",
        label: "Anthropic",
        description: "Claude Sonnet 4, Haiku — advanced reasoning",
        icon: "🔮",
        color: "#7c3aed",
        glowColor: "rgba(124, 58, 237, 0.2)",
        placeholder: "sk-ant-...",
        getKeyUrl: "https://console.anthropic.com/settings/keys",
        hasApiKey: true,
        hasModels: true,
    },
    {
        id: "gemini",
        label: "Google Gemini",
        description: "Gemini 2.5 Flash/Pro — 1M context, free tier",
        icon: "💎",
        color: "#4285f4",
        glowColor: "rgba(66, 133, 244, 0.2)",
        placeholder: "AIza...",
        getKeyUrl: "https://aistudio.google.com/apikey",
        hasApiKey: true,
        hasModels: true,
    },
    {
        id: "tavily",
        label: "Tavily",
        description: "Web intelligence + doc research — real-time facts",
        icon: "🌐",
        color: "#00d4ff",
        glowColor: "rgba(0, 212, 255, 0.2)",
        placeholder: "tvly-...",
        getKeyUrl: "https://app.tavily.com/home",
        hasApiKey: true,
        hasModels: false,
    },
];

/* ═══════════════════════════════════════════
   STATUS BADGE
   ═══════════════════════════════════════════ */

function StatusBadge({ status }: { status: ProviderStatus }) {
    const map: Record<ProviderStatus["status"], { label: string; cls: string; icon: string }> = {
        valid: { label: "Connected", cls: "badge-success", icon: "✓" },
        invalid: { label: "Invalid Key", cls: "badge-error", icon: "✕" },
        no_key: { label: "No Key", cls: "badge-warning", icon: "!" },
        checking: { label: "Checking...", cls: "badge-info", icon: "⟳" },
        error: { label: status.detail, cls: "badge-error", icon: "✕" },
    };
    const s = map[status.status];
    return (
        <span className={`badge ${s.cls}`}>
            <span>{s.icon}</span> {s.label}
        </span>
    );
}

/* ═══════════════════════════════════════════
   MODEL SELECTOR
   ═══════════════════════════════════════════ */

function ModelSelector({
    models,
    selectedModel,
    onSelect,
    provider,
}: {
    models: ModelInfo[];
    selectedModel: string;
    onSelect: (id: string) => void;
    provider: ProviderName;
}) {
    const [open, setOpen] = useState(false);
    const current = models.find(m => m.id === selectedModel) || models[0];

    const tierColors: Record<string, string> = {
        flagship: "badge-purple",
        fast: "badge-success",
        reasoning: "badge-info",
        budget: "badge-warning",
        local: "badge-warning",
    };

    return (
        <div className="model-select" style={{ marginTop: 12 }}>
            <div className="model-select-trigger" onClick={() => setOpen(!open)}>
                <div>
                    <span style={{ fontWeight: 500 }}>{current?.name || "Select model"}</span>
                    {current && (
                        <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 8 }}>
                            {current.contextWindow > 0 ? `${(current.contextWindow / 1000).toFixed(0)}K ctx` : ""}
                        </span>
                    )}
                </div>
                <span style={{ color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
            </div>
            {open && (
                <div className="model-select-dropdown animate-in">
                    {models.map(m => (
                        <div
                            key={m.id}
                            className={`model-option ${m.id === selectedModel ? "selected" : ""}`}
                            onClick={() => { onSelect(m.id); setOpen(false); }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="model-option-name">{m.name}</span>
                                <span className={`badge ${tierColors[m.tier] || "badge-info"}`}
                                    style={{ fontSize: 9, padding: "1px 6px" }}>
                                    {m.tier}
                                </span>
                            </div>
                            <div className="model-option-desc">{m.description}</div>
                            {m.contextWindow > 0 && (
                                <div className="model-option-meta">
                                    <span className="badge badge-info" style={{ fontSize: 9, padding: "1px 6px" }}>
                                        {(m.contextWindow / 1000).toFixed(0)}K context
                                    </span>
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
   PROVIDER CARD
   ═══════════════════════════════════════════ */

function ProviderCard({ def }: { def: ProviderDef }) {
    const [config, setConfig] = useState(getProviderConfig(def.id));
    const [status, setStatus] = useState<ProviderStatus>({ available: false, detail: "", status: "checking" });
    const [checking, setChecking] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const [ollamaModels, setOllamaModels] = useState<ModelInfo[]>([]);
    const [geminiModels, setGeminiModels] = useState<ModelInfo[]>(GEMINI_MODELS);
    const [pullProgress, setPullProgress] = useState<string | null>(null);
    const [pullModelName, setPullModelName] = useState("");

    const selectedModel = getSelectedModel(def.id);

    // Auto-validate on mount + load dynamic models
    useEffect(() => {
        validate();
        if (def.id === "ollama") {
            listOllamaModels().then(setOllamaModels);
        }
        if (def.id === "gemini") {
            listGeminiModels().then(setGeminiModels);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validate = useCallback(async () => {
        setChecking(true);
        setStatus({ available: false, detail: "Checking...", status: "checking" });
        const result = await validateProvider(def.id);
        setStatus(result);
        setChecking(false);
    }, [def.id]);

    const handleKeyChange = (value: string) => {
        const newConfig = { ...config, apiKey: value };
        setConfig(newConfig);
        setProviderConfig(def.id, newConfig);
    };

    const handleBaseUrlChange = (value: string) => {
        const newConfig = { ...config, baseUrl: value };
        setConfig(newConfig);
        setProviderConfig(def.id, newConfig);
    };

    const handleModelSelect = (modelId: string) => {
        setSelectedModel(def.id, modelId);
    };

    const handlePull = async () => {
        if (!pullModelName.trim()) return;
        setPullProgress("Starting pull...");
        const success = await pullOllamaModel(pullModelName.trim(), (s, completed, total) => {
            if (total > 0) {
                setPullProgress(`${s}: ${Math.round((completed / total) * 100)}%`);
            } else {
                setPullProgress(s);
            }
        });
        setPullProgress(success ? "✓ Pull complete!" : "✕ Pull failed");
        // Refresh model list
        const models = await listOllamaModels();
        setOllamaModels(models);
        setTimeout(() => setPullProgress(null), 3000);
    };

    const getModels = (): ModelInfo[] => {
        switch (def.id) {
            case "openai": return OPENAI_MODELS;
            case "anthropic": return ANTHROPIC_MODELS;
            case "groq": return GROQ_MODELS;
            case "openrouter": return OPENROUTER_MODELS;
            case "gemini": return geminiModels;
            case "ollama": return ollamaModels;
            default: return [];
        }
    };

    const statusClass = status.status === "valid" ? "connected" : status.status === "error" || status.status === "invalid" ? "error" : "";

    return (
        <div className={`provider-card ${statusClass} animate-in`}>
            <div className="provider-card-header">
                <div className="provider-card-icon"
                    style={{ background: def.glowColor, fontSize: 20 }}>
                    {def.icon}
                </div>
                <div className="provider-card-info">
                    <div className="provider-card-name">{def.label}</div>
                    <div className="provider-card-desc">{def.description}</div>
                </div>
                <StatusBadge status={status} />
            </div>

            {/* API Key Input */}
            {def.hasApiKey && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                        API Key ·{" "}
                        <a href={def.getKeyUrl} target="_blank" rel="noopener"
                            style={{ color: "var(--accent-primary)", textDecoration: "none" }}>
                            Get key →
                        </a>
                    </div>
                    <div className="api-key-input">
                        <input
                            className="input input-mono"
                            type={showKey ? "text" : "password"}
                            placeholder={def.placeholder}
                            value={config.apiKey}
                            onChange={e => handleKeyChange(e.target.value)}
                            onBlur={() => validate()}
                        />
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowKey(!showKey)}
                            title={showKey ? "Hide" : "Show"}>
                            {showKey ? "🙈" : "👁️"}
                        </button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={validate}
                            disabled={checking}
                            title="Verify key">
                            {checking ? "⟳" : "✓"}
                        </button>
                    </div>
                </div>
            )}

            {/* Ollama Base URL */}
            {def.id === "ollama" && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                        Base URL
                    </div>
                    <div className="api-key-input">
                        <input
                            className="input input-mono"
                            type="text"
                            placeholder="http://localhost:11434"
                            value={config.baseUrl || ""}
                            onChange={e => handleBaseUrlChange(e.target.value)}
                            onBlur={() => validate()}
                        />
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={validate}
                            disabled={checking}
                            title="Check connection">
                            {checking ? "⟳" : "🔄"}
                        </button>
                    </div>
                </div>
            )}

            {/* Model Selector */}
            {def.hasModels && getModels().length > 0 && (
                <ModelSelector
                    models={getModels()}
                    selectedModel={selectedModel}
                    onSelect={handleModelSelect}
                    provider={def.id}
                />
            )}

            {/* Ollama Pull Model */}
            {def.id === "ollama" && status.status === "valid" && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--bg-primary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                        Pull New Model
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            className="input input-mono"
                            type="text"
                            placeholder="e.g. llama3.3, qwen2.5-coder"
                            value={pullModelName}
                            onChange={e => setPullModelName(e.target.value)}
                            style={{ flex: 1, fontSize: 12 }}
                        />
                        <button className="btn btn-primary btn-sm" onClick={handlePull}
                            disabled={!!pullProgress || !pullModelName.trim()}>
                            Pull
                        </button>
                    </div>
                    {pullProgress && (
                        <div style={{ marginTop: 6, fontSize: 11, color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>
                            {pullProgress}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════
   ORCHESTRATION SECTION — Task Routing
   ═══════════════════════════════════════════ */

const PROVIDER_OPTIONS: { value: ProviderName | ''; label: string }[] = [
    { value: '', label: 'Auto (best available)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'groq', label: 'Groq' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'ollama', label: 'Ollama' },
];

function OrchestrationSection() {
    const [settings, setSettings] = useState<RouterSettings>(getRouterSettings);

    const updateAndSave = useCallback((fn: (s: RouterSettings) => RouterSettings) => {
        setSettings(prev => {
            const next = fn(prev);
            saveRouterSettings(next);
            return next;
        });
    }, []);

    const updateRule = useCallback((taskType: TaskType, field: string, value: unknown) => {
        updateAndSave(s => ({
            ...s,
            rules: s.rules.map(r =>
                r.taskType === taskType ? { ...r, [field]: value } : r
            ),
        }));
    }, [updateAndSave]);

    return (
        <div className="settings-section">
            <div className="settings-section-title">
                Orchestration Rules
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                How Construct routes tasks to providers. Each task type can prefer a specific provider.
            </p>

            {/* Task Routing Rules */}
            {settings.rules.map(rule => (
                <div key={rule.taskType} className="glass-card" style={{ marginBottom: 8, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{getTaskTypeLabel(rule.taskType)}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{getTaskTypeDescription(rule.taskType)}</div>
                        </div>
                        <div
                            className={`toggle ${rule.enabled ? 'active' : ''}`}
                            onClick={() => updateRule(rule.taskType, 'enabled', !rule.enabled)}
                        />
                    </div>
                    {rule.enabled && (
                        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 140 }}>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Prefer Provider</div>
                                <select
                                    value={rule.preferProvider || ''}
                                    onChange={e => updateRule(rule.taskType, 'preferProvider', e.target.value || undefined)}
                                    style={{
                                        width: "100%", padding: "4px 8px", fontSize: 12,
                                        background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                        border: "1px solid var(--border-subtle)", borderRadius: 6,
                                    }}
                                >
                                    {PROVIDER_OPTIONS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ width: 80 }}>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Temperature</div>
                                <input
                                    type="number"
                                    min={0} max={1} step={0.1}
                                    value={rule.temperature ?? 0.3}
                                    onChange={e => updateRule(rule.taskType, 'temperature', parseFloat(e.target.value))}
                                    style={{
                                        width: "100%", padding: "4px 8px", fontSize: 12,
                                        background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                        border: "1px solid var(--border-subtle)", borderRadius: 6,
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            ))}

            {/* Parallel Workers */}
            <div style={{ marginTop: 16, marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Parallel Workers</div>
                <div className="settings-row">
                    <div className="settings-row-label">
                        <span>Enable Parallel Dispatch</span>
                        <span>Dispatch research workers across available API keys</span>
                    </div>
                    <div
                        className={`toggle ${settings.parallelWorkers.enabled ? 'active' : ''}`}
                        onClick={() => updateAndSave(s => ({
                            ...s,
                            parallelWorkers: { ...s.parallelWorkers, enabled: !s.parallelWorkers.enabled },
                        }))}
                    />
                </div>
                {settings.parallelWorkers.enabled && (
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Max Workers</div>
                            <input
                                type="number"
                                min={1} max={8}
                                value={settings.parallelWorkers.maxWorkers}
                                onChange={e => updateAndSave(s => ({
                                    ...s,
                                    parallelWorkers: { ...s.parallelWorkers, maxWorkers: parseInt(e.target.value) || 4 },
                                }))}
                                style={{
                                    width: "100%", padding: "4px 8px", fontSize: 12,
                                    background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                    border: "1px solid var(--border-subtle)", borderRadius: 6,
                                }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Research Depth</div>
                            <select
                                value={settings.parallelWorkers.researchDepth}
                                onChange={e => updateAndSave(s => ({
                                    ...s,
                                    parallelWorkers: { ...s.parallelWorkers, researchDepth: e.target.value as 'basic' | 'advanced' },
                                }))}
                                style={{
                                    width: "100%", padding: "4px 8px", fontSize: 12,
                                    background: "var(--bg-tertiary)", color: "var(--text-primary)",
                                    border: "1px solid var(--border-subtle)", borderRadius: 6,
                                }}
                            >
                                <option value="basic">Basic</option>
                                <option value="advanced">Advanced</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Cost Controls */}
            <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Cost Controls</div>
                <div className="settings-row">
                    <div className="settings-row-label">
                        <span>Prefer Free Models</span>
                        <span>Use Groq, Ollama, or free-tier models when available</span>
                    </div>
                    <div
                        className={`toggle ${settings.costControls.preferFreeModels ? 'active' : ''}`}
                        onClick={() => updateAndSave(s => ({
                            ...s,
                            costControls: { ...s.costControls, preferFreeModels: !s.costControls.preferFreeModels },
                        }))}
                    />
                </div>
                <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>Max Tokens per Session</div>
                    <input
                        type="number"
                        min={10000} max={2000000} step={50000}
                        value={settings.costControls.maxTokensPerSession}
                        onChange={e => updateAndSave(s => ({
                            ...s,
                            costControls: { ...s.costControls, maxTokensPerSession: parseInt(e.target.value) || 500000 },
                        }))}
                        style={{
                            width: 160, padding: "4px 8px", fontSize: 12,
                            background: "var(--bg-tertiary)", color: "var(--text-primary)",
                            border: "1px solid var(--border-subtle)", borderRadius: 6,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════
   MAIN SETTINGS PANEL
   ═══════════════════════════════════════════ */

export default function SettingsPanel() {
    return (
        <div className="settings-page" style={{ maxWidth: 720 }}>
            {/* ── AI Providers ── */}
            <div className="settings-section">
                <div className="settings-section-title">
                    <span style={{ fontSize: 18 }}>⚡</span>
                    AI Providers
                </div>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                    Configure your AI providers. ShellShockHive intelligently orchestrates between all
                    connected providers — using the best model for each task. Settings apply immediately.
                </p>
                {PROVIDERS.map(def => (
                    <ProviderCard key={def.id} def={def} />
                ))}
            </div>

            {/* ── Orchestration ── */}
            <OrchestrationSection />

            {/* ── Agent Behavior ── */}
            <div className="settings-section">
                <div className="settings-section-title">
                    <span style={{ fontSize: 18 }}>🤖</span>
                    Agent Behavior
                </div>

                <div className="settings-row">
                    <div className="settings-row-label">
                        <span>Hallucination Detection</span>
                        <span>Cross-validate generated code with a second model</span>
                    </div>
                    <div className="toggle active" />
                </div>

                <div className="settings-row">
                    <div className="settings-row-label">
                        <span>Persistent Memory</span>
                        <span>Remember patterns and preferences across sessions</span>
                    </div>
                    <div className="toggle active" />
                </div>

                <div className="settings-row">
                    <div className="settings-row-label">
                        <span>Auto-run Terminal Commands</span>
                        <span>Let the agent run npm, build commands without asking</span>
                    </div>
                    <div className="toggle" />
                </div>

                <div className="settings-row">
                    <div className="settings-row-label">
                        <span>Stream Responses</span>
                        <span>Show tokens as they arrive (vs. full response)</span>
                    </div>
                    <div className="toggle active" />
                </div>
            </div>
        </div>
    );
}
