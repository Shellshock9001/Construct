/* ═══════════════════════════════════════════════════════════════════
   Construct — Agent Pool & Key Rotation

   Manages multiple API keys per provider as independent "agent slots."
   Each slot can be assigned a role (primary, research, validator).
   Key rotation happens automatically when a slot hits rate limits.

   Graceful degradation: with a single key per provider, the pool
   simply acts as the current system — no overhead.
   ═══════════════════════════════════════════════════════════════════ */

import { type ProviderName, getProviderConfig } from './providers';

/* ─── Types ─── */

export type AgentRole = 'primary' | 'research' | 'validator' | 'general';

export interface AgentSlot {
    id: string;                      // e.g. "gemini-0", "tavily-1"
    provider: ProviderName;
    apiKey: string;
    role: AgentRole;
    status: 'idle' | 'busy' | 'cooldown' | 'error';
    currentTask?: string;
    cooldownUntil?: number;          // timestamp when cooldown expires
    model?: string;                  // which model this slot uses
    stats: {
        totalCalls: number;
        totalTokens: number;
        errorsThisSession: number;
        lastCallTimestamp: number;
    };
}

/* ─── Storage for extra keys ─── */

const STORAGE_KEY = 'construct_extra_keys';

interface StoredExtraKeys {
    [provider: string]: Array<{
        apiKey: string;
        role: AgentRole;
        label?: string;
    }>;
}

export function getExtraKeys(): StoredExtraKeys {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function setExtraKeys(keys: StoredExtraKeys): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function addExtraKey(provider: ProviderName, apiKey: string, role: AgentRole = 'general'): void {
    const keys = getExtraKeys();
    if (!keys[provider]) keys[provider] = [];

    // Don't add duplicates
    if (keys[provider].some(k => k.apiKey === apiKey)) return;

    keys[provider].push({ apiKey, role });
    setExtraKeys(keys);
}

export function removeExtraKey(provider: ProviderName, apiKey: string): void {
    const keys = getExtraKeys();
    if (!keys[provider]) return;
    keys[provider] = keys[provider].filter(k => k.apiKey !== apiKey);
    setExtraKeys(keys);
}

/* ═══════════════════════════════════════════
   AGENT POOL
   ═══════════════════════════════════════════ */

class AgentPool {
    private slots: AgentSlot[] = [];
    private roundRobinIndex: Record<string, number> = {};

    /** Rebuild slots from primary configs + extra keys */
    rebuild(): void {
        this.slots = [];
        const providers: ProviderName[] = ['gemini', 'openai', 'anthropic', 'groq', 'openrouter', 'ollama', 'tavily'];

        for (const provider of providers) {
            const config = getProviderConfig(provider);

            // Primary key (from main settings)
            if (config.apiKey || provider === 'ollama') {
                this.slots.push(this.createSlot(provider, config.apiKey || 'local', 'primary', 0));
            }

            // Extra keys
            const extras = getExtraKeys()[provider] || [];
            for (let i = 0; i < extras.length; i++) {
                if (extras[i].apiKey) {
                    this.slots.push(this.createSlot(provider, extras[i].apiKey, extras[i].role, i + 1));
                }
            }
        }
    }

    private createSlot(provider: ProviderName, apiKey: string, role: AgentRole, index: number): AgentSlot {
        return {
            id: `${provider}-${index}`,
            provider,
            apiKey,
            role,
            status: 'idle',
            stats: {
                totalCalls: 0,
                totalTokens: 0,
                errorsThisSession: 0,
                lastCallTimestamp: 0,
            },
        };
    }

    /** Get the best available slot for a given role and provider */
    acquire(role: AgentRole, preferProvider?: ProviderName, excludeIds?: string[]): AgentSlot | null {
        // Clear expired cooldowns first
        this.clearExpiredCooldowns();

        // Filter candidates
        const candidates = this.slots.filter(s => {
            if (s.status !== 'idle') return false;
            if (excludeIds?.includes(s.id)) return false;
            if (preferProvider && s.provider !== preferProvider) return false;
            // Role matching: 'general' slots can fill any role
            if (s.role !== role && s.role !== 'general' && role !== 'general') return false;
            return true;
        });

        if (candidates.length === 0) {
            // Fallback: try any idle slot of the right provider regardless of role
            if (preferProvider) {
                const fallback = this.slots.find(s =>
                    s.status === 'idle' &&
                    s.provider === preferProvider &&
                    !excludeIds?.includes(s.id)
                );
                if (fallback) {
                    fallback.status = 'busy';
                    return fallback;
                }
            }
            return null;
        }

        // Prefer slots with fewer errors and lower call count
        candidates.sort((a, b) => {
            if (a.stats.errorsThisSession !== b.stats.errorsThisSession) {
                return a.stats.errorsThisSession - b.stats.errorsThisSession;
            }
            return a.stats.totalCalls - b.stats.totalCalls;
        });

        const slot = candidates[0];
        slot.status = 'busy';
        return slot;
    }

    /** Release a slot back to idle */
    release(slotId: string): void {
        const slot = this.slots.find(s => s.id === slotId);
        if (slot) {
            slot.status = 'idle';
            slot.currentTask = undefined;
        }
    }

    /** Mark slot as rate-limited with cooldown */
    cooldown(slotId: string, durationMs: number = 10_000): void {
        const slot = this.slots.find(s => s.id === slotId);
        if (slot) {
            slot.status = 'cooldown';
            slot.cooldownUntil = Date.now() + durationMs;
        }
    }

    /** Mark slot as errored */
    markError(slotId: string): void {
        const slot = this.slots.find(s => s.id === slotId);
        if (slot) {
            slot.stats.errorsThisSession++;
            // After 5 errors, disable for the session
            if (slot.stats.errorsThisSession >= 5) {
                slot.status = 'error';
            } else {
                slot.status = 'idle';
            }
        }
    }

    /** Record a successful call */
    recordCall(slotId: string, tokens: number = 0): void {
        const slot = this.slots.find(s => s.id === slotId);
        if (slot) {
            slot.stats.totalCalls++;
            slot.stats.totalTokens += tokens;
            slot.stats.lastCallTimestamp = Date.now();
        }
    }

    /** Round-robin key rotation within a provider */
    nextKey(provider: ProviderName): { key: string; slotId: string } | null {
        const available = this.slots.filter(s =>
            s.provider === provider && s.status === 'idle'
        );
        if (available.length === 0) return null;

        const idx = (this.roundRobinIndex[provider] || 0) % available.length;
        this.roundRobinIndex[provider] = idx + 1;

        return { key: available[idx].apiKey, slotId: available[idx].id };
    }

    /** Get all slots (for UI display) */
    getSlots(): readonly AgentSlot[] {
        return this.slots;
    }

    /** Get count of available slots by role */
    getAvailability(): Record<AgentRole, number> {
        this.clearExpiredCooldowns();
        const counts: Record<AgentRole, number> = { primary: 0, research: 0, validator: 0, general: 0 };
        for (const s of this.slots) {
            if (s.status === 'idle') {
                counts[s.role]++;
            }
        }
        return counts;
    }

    /** Check if multi-agent mode is available (more than one usable slot) */
    isMultiAgentAvailable(): boolean {
        return this.slots.filter(s => s.status !== 'error').length > 1;
    }

    /** Get count of providers with keys */
    getActiveProviderCount(): number {
        const providers = new Set(this.slots.filter(s => s.status !== 'error').map(s => s.provider));
        return providers.size;
    }

    /** Get all research-capable slots (Tavily keys) */
    getResearchSlots(): AgentSlot[] {
        this.clearExpiredCooldowns();
        return this.slots.filter(s =>
            s.provider === 'tavily' &&
            s.status === 'idle'
        );
    }

    /** Get all LLM-capable slots (everything except Tavily) */
    getLLMSlots(): AgentSlot[] {
        this.clearExpiredCooldowns();
        return this.slots.filter(s =>
            s.provider !== 'tavily' &&
            s.status === 'idle'
        );
    }

    /** Clear expired cooldowns */
    private clearExpiredCooldowns(): void {
        const now = Date.now();
        for (const slot of this.slots) {
            if (slot.status === 'cooldown' && slot.cooldownUntil && slot.cooldownUntil <= now) {
                slot.status = 'idle';
                slot.cooldownUntil = undefined;
            }
        }
    }

    /** Reset all session stats (new session) */
    resetStats(): void {
        for (const slot of this.slots) {
            slot.stats = {
                totalCalls: 0,
                totalTokens: 0,
                errorsThisSession: 0,
                lastCallTimestamp: 0,
            };
            if (slot.status === 'error') slot.status = 'idle';
            if (slot.status === 'busy') slot.status = 'idle';
            slot.currentTask = undefined;
        }
    }
}

/* ═══════════════════════════════════════════
   SINGLETON INSTANCE
   ═══════════════════════════════════════════ */

export const pool = new AgentPool();

export type { AgentPool };
