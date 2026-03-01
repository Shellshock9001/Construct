/* ═══════════════════════════════════════════════════════════════════
   Construct — Orchestration Ledger & Dedup Engine

   The single source of truth for multi-agent coordination.
   Every agent reads from and writes to the ledger before acting.
   The dedup engine prevents redundant research/LLM calls.

   Graceful degradation: with a single agent, the ledger still
   acts as a session cache — no performance penalty.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ─── */

export type LedgerEventType =
    | 'research_started'
    | 'research_complete'
    | 'research_failed'
    | 'validation_started'
    | 'validation_complete'
    | 'code_generated'
    | 'code_validated'
    | 'tool_called'
    | 'tool_result'
    | 'insight_shared'
    | 'agent_assigned'
    | 'agent_released';

export interface LedgerEntry {
    id: string;
    timestamp: number;
    agentId: string;
    type: LedgerEventType;
    topic: string;          // searchable key for dedup matching
    payload: unknown;        // type-specific data
    cost?: {
        tokens: number;
        estimatedUsd: number;
    };
}

export interface LedgerCostSummary {
    totalTokens: number;
    estimatedUsd: number;
    byAgent: Record<string, { tokens: number; usd: number }>;
}

export interface ActiveAgent {
    agentId: string;
    task: string;
    startedAt: number;
}

/* ─── Token-to-USD cost model (approximate, per 1M tokens) ─── */

const COST_PER_MILLION: Record<string, number> = {
    'gemini-2.5-flash': 0.15,
    'gemini-2.5-pro': 1.25,
    'gemini-2.0-flash': 0.10,
    'gpt-4o': 2.50,
    'gpt-4o-mini': 0.15,
    'claude-sonnet-4': 3.00,
    'claude-3-5-haiku': 0.25,
    'ollama': 0,        // local = free
    'groq': 0,          // free tier
    'openrouter-free': 0,
    'default': 0.50,
};

export function estimateCost(tokens: number, model?: string): number {
    const key = model && COST_PER_MILLION[model] !== undefined ? model : 'default';
    return (tokens / 1_000_000) * COST_PER_MILLION[key];
}

/* ═══════════════════════════════════════════
   SHARED LEDGER
   ═══════════════════════════════════════════ */

type LedgerSubscriber = (entry: LedgerEntry) => void;

class SharedLedger {
    private entries: LedgerEntry[] = [];
    private subscribers = new Set<LedgerSubscriber>();

    /* ── Write ── */

    log(partial: Omit<LedgerEntry, 'id' | 'timestamp'>): LedgerEntry {
        const entry: LedgerEntry = {
            ...partial,
            id: `${partial.agentId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: Date.now(),
        };
        this.entries.push(entry);

        // Notify subscribers (non-blocking)
        Array.from(this.subscribers).forEach(cb => {
            try { cb(entry); } catch { /* subscriber error shouldn't crash ledger */ }
        });

        return entry;
    }

    /* ── Read: Active research ── */

    hasActiveResearch(topic: string): boolean {
        const normalized = this.normalizeTopic(topic);
        return this.entries.some(e =>
            e.type === 'research_started' &&
            this.similarity(this.normalizeTopic(e.topic), normalized) > 0.65 &&
            !this.isResearchComplete(e.id)
        );
    }

    getActiveResearchAgent(topic: string): string | null {
        const normalized = this.normalizeTopic(topic);
        const active = this.entries.find(e =>
            e.type === 'research_started' &&
            this.similarity(this.normalizeTopic(e.topic), normalized) > 0.65 &&
            !this.isResearchComplete(e.id)
        );
        return active?.agentId ?? null;
    }

    /* ── Read: Completed research (cache) ── */

    getCompletedResearch(topic: string): LedgerEntry | null {
        const normalized = this.normalizeTopic(topic);
        // Search in reverse (most recent first)
        for (let i = this.entries.length - 1; i >= 0; i--) {
            const e = this.entries[i];
            if (
                e.type === 'research_complete' &&
                this.similarity(this.normalizeTopic(e.topic), normalized) > 0.65 &&
                // Cache valid for 10 minutes
                Date.now() - e.timestamp < 600_000
            ) {
                return e;
            }
        }
        return null;
    }

    /* ── Read: Active agents ── */

    getActiveAgents(): ActiveAgent[] {
        const active = new Map<string, ActiveAgent>();

        for (const e of this.entries) {
            if (e.type === 'agent_assigned') {
                active.set(e.agentId, {
                    agentId: e.agentId,
                    task: e.topic,
                    startedAt: e.timestamp,
                });
            } else if (e.type === 'agent_released') {
                active.delete(e.agentId);
            }
        }

        return Array.from(active.values());
    }

    /* ── Read: Cost tracking ── */

    getCost(): LedgerCostSummary {
        const byAgent: Record<string, { tokens: number; usd: number }> = {};
        let totalTokens = 0;
        let totalUsd = 0;

        for (const e of this.entries) {
            if (e.cost) {
                totalTokens += e.cost.tokens;
                totalUsd += e.cost.estimatedUsd;

                if (!byAgent[e.agentId]) {
                    byAgent[e.agentId] = { tokens: 0, usd: 0 };
                }
                byAgent[e.agentId].tokens += e.cost.tokens;
                byAgent[e.agentId].usd += e.cost.estimatedUsd;
            }
        }

        return { totalTokens, estimatedUsd: totalUsd, byAgent };
    }

    /* ── Read: Recent insights ── */

    getRecentInsights(withinMs: number = 300_000): string[] {
        const cutoff = Date.now() - withinMs;
        return this.entries
            .filter(e => e.type === 'insight_shared' && e.timestamp > cutoff)
            .map(e => e.payload as string);
    }

    /* ── Read: All entries (for UI) ── */

    getAll(): readonly LedgerEntry[] {
        return this.entries;
    }

    getRecent(count: number = 20): LedgerEntry[] {
        return this.entries.slice(-count);
    }

    /* ── Subscribe ── */

    subscribe(cb: LedgerSubscriber): () => void {
        this.subscribers.add(cb);
        return () => this.subscribers.delete(cb);
    }

    /* ── Reset (new session) ── */

    clear(): void {
        this.entries = [];
    }

    /* ── Internal helpers ── */

    private isResearchComplete(startEntryId: string): boolean {
        const startEntry = this.entries.find(e => e.id === startEntryId);
        if (!startEntry) return false;

        return this.entries.some(e =>
            (e.type === 'research_complete' || e.type === 'research_failed') &&
            e.agentId === startEntry.agentId &&
            e.timestamp > startEntry.timestamp &&
            this.similarity(
                this.normalizeTopic(e.topic),
                this.normalizeTopic(startEntry.topic)
            ) > 0.65
        );
    }

    private normalizeTopic(topic: string): string {
        return topic
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Jaccard keyword similarity — no external API needed */
    similarity(a: string, b: string): number {
        const wordsA = a.split(' ').filter(w => w.length > 2);
        const wordsB = b.split(' ').filter(w => w.length > 2);
        const setB = new Set(wordsB);
        if (wordsA.length === 0 && wordsB.length === 0) return 1;
        if (wordsA.length === 0 || wordsB.length === 0) return 0;

        let intersection = 0;
        const seen = new Set<string>();
        for (let i = 0; i < wordsA.length; i++) {
            if (setB.has(wordsA[i])) intersection++;
            seen.add(wordsA[i]);
        }
        for (let i = 0; i < wordsB.length; i++) {
            seen.add(wordsB[i]);
        }

        return intersection / seen.size;
    }
}

/* ═══════════════════════════════════════════
   DEDUP ENGINE
   ═══════════════════════════════════════════ */

export type DedupDecision =
    | { action: 'proceed' }
    | { action: 'wait'; agentId: string; topic: string }
    | { action: 'use_cached'; result: unknown; topic: string };

export function checkDedup(ledger: SharedLedger, query: string): DedupDecision {
    // 1. Check for cached completed research
    const cached = ledger.getCompletedResearch(query);
    if (cached) {
        return { action: 'use_cached', result: cached.payload, topic: cached.topic };
    }

    // 2. Check for active research on similar topic
    const activeAgent = ledger.getActiveResearchAgent(query);
    if (activeAgent) {
        return { action: 'wait', agentId: activeAgent, topic: query };
    }

    // 3. Nothing found — proceed
    return { action: 'proceed' };
}

/** Wait for a specific agent's research to complete (with timeout) */
export function waitForResearch(
    ledger: SharedLedger,
    topic: string,
    timeoutMs: number = 30_000,
): Promise<unknown | null> {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            unsub();
            resolve(null); // timed out — let caller proceed independently
        }, timeoutMs);

        const unsub = ledger.subscribe(entry => {
            if (
                entry.type === 'research_complete' &&
                ledger.similarity(
                    entry.topic.toLowerCase(),
                    topic.toLowerCase()
                ) > 0.65
            ) {
                clearTimeout(timer);
                unsub();
                resolve(entry.payload);
            }
        });
    });
}

/* ═══════════════════════════════════════════
   AWARENESS CONTEXT BUILDER
   ═══════════════════════════════════════════ */

/** Build awareness context for an agent's system prompt */
export function buildAwarenessContext(agentId: string, ledger: SharedLedger): string {
    const active = ledger.getActiveAgents().filter(a => a.agentId !== agentId);
    const insights = ledger.getRecentInsights();
    const cost = ledger.getCost();

    // Solo mode — no overhead
    if (active.length === 0 && insights.length === 0) {
        return '';
    }

    const parts: string[] = [
        '\n## 🤝 Assisted Intelligence Active',
        `You are being supported by ${active.length} other agent(s):`,
    ];

    if (active.length > 0) {
        for (const a of active) {
            const elapsed = Math.round((Date.now() - a.startedAt) / 1000);
            parts.push(`- **${a.agentId}**: ${a.task} (${elapsed}s ago)`);
        }
    }

    if (insights.length > 0) {
        parts.push('\n### Recent Insights from Other Agents');
        for (const i of insights.slice(-5)) {
            parts.push(`- ${i}`);
        }
    }

    parts.push(`\n### Session Cost`);
    parts.push(`Tokens: ${cost.totalTokens.toLocaleString()} | Est. cost: $${cost.estimatedUsd.toFixed(4)}`);
    parts.push('\n**Rules**: Do NOT research anything another agent is already working on.');
    parts.push('Check the ledger before calling deep_research or web_search.');
    parts.push('If another agent shares an insight relevant to your work, USE IT.');

    return parts.join('\n');
}

/* ═══════════════════════════════════════════
   SINGLETON INSTANCE
   ═══════════════════════════════════════════ */

/** Global ledger instance — shared across all agents in the session */
export const ledger = new SharedLedger();

export type { SharedLedger };
