/* ═══════════════════════════════════════════════════════════════════
   Construct — Parallel Research Coordinator

   Fan-out research across multiple Tavily keys and LLM agents.
   When the primary agent hits a gap, research agents work in
   parallel while the primary agent continues coding.

   Graceful degradation:
   - 1 Tavily key → sequential research (current behavior)
   - 2+ Tavily keys → parallel fan-out
   - 0 Tavily keys → research via LLM context only
   ═══════════════════════════════════════════════════════════════════ */

import { type AgentPool } from './agentPool';
import {
    type SharedLedger,
    checkDedup,
    waitForResearch,
    estimateCost,
} from './orchestrationLedger';
import { searchTavily, type TavilySearchResult, getProviderConfig } from './providers';

/* ─── Types ─── */

export interface ResearchTask {
    question: string;
    priority: 'critical' | 'nice_to_have';
    requestingAgent: string;
}

export interface ResearchResult {
    question: string;
    answer: string;
    sources: Array<{ title: string; url: string; snippet: string }>;
    fromCache: boolean;
    agentId: string;
}

/* ═══════════════════════════════════════════
   FAN-OUT RESEARCH
   ═══════════════════════════════════════════ */

/**
 * Research multiple questions in parallel, using available Tavily slots.
 * Respects dedup — won't research what's already been researched or is in-flight.
 */
export async function parallelResearch(
    questions: ResearchTask[],
    pool: AgentPool,
    ledger: SharedLedger,
): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    const pendingPromises: Promise<void>[] = [];

    // Sort by priority — critical first
    const sorted = [...questions].sort((a, b) =>
        a.priority === 'critical' && b.priority !== 'critical' ? -1 :
            b.priority === 'critical' && a.priority !== 'critical' ? 1 : 0
    );

    for (const task of sorted) {
        // Dedup check
        const dedup = checkDedup(ledger, task.question);

        if (dedup.action === 'use_cached') {
            // Already have results — use them
            const cached = dedup.result as any;
            results.push({
                question: task.question,
                answer: typeof cached === 'string' ? cached : cached?.answer || JSON.stringify(cached),
                sources: cached?.sources || [],
                fromCache: true,
                agentId: 'cache',
            });
            continue;
        }

        if (dedup.action === 'wait') {
            // Another agent is already researching this — wait for it
            const promise = waitForResearch(ledger, task.question, 30_000).then(result => {
                if (result) {
                    const r = result as any;
                    results.push({
                        question: task.question,
                        answer: typeof r === 'string' ? r : r?.answer || '',
                        sources: r?.sources || [],
                        fromCache: true,
                        agentId: dedup.agentId,
                    });
                }
                // If null (timed out), we'll just skip this one
            });
            pendingPromises.push(promise);
            continue;
        }

        // Proceed — acquire a Tavily slot
        const slot = pool.acquire('research', 'tavily');

        if (!slot) {
            // No available Tavily slot — queue it for sequential processing
            pendingPromises.push(
                executeSingleResearch(task, 'sequential-0', pool, ledger).then(r => {
                    if (r) results.push(r);
                })
            );
            continue;
        }

        // Parallel execution
        const promise = executeSingleResearch(task, slot.id, pool, ledger).then(r => {
            pool.release(slot.id);
            if (r) results.push(r);
        }).catch(() => {
            pool.markError(slot.id);
            pool.release(slot.id);
        });

        pendingPromises.push(promise);
    }

    // Wait for all parallel research to complete
    await Promise.allSettled(pendingPromises);

    return results;
}

/**
 * Execute a single research task using Tavily.
 * Logs to ledger for dedup and cross-agent visibility.
 */
async function executeSingleResearch(
    task: ResearchTask,
    agentId: string,
    pool: AgentPool,
    ledger: SharedLedger,
): Promise<ResearchResult | null> {
    // Log start
    ledger.log({
        agentId,
        type: 'research_started',
        topic: task.question,
        payload: { priority: task.priority, requestedBy: task.requestingAgent },
    });

    try {
        const result = await searchTavily(task.question, {
            depth: task.priority === 'critical' ? 'advanced' : 'basic',
            maxResults: 5,
        });

        if (!result) {
            ledger.log({
                agentId,
                type: 'research_failed',
                topic: task.question,
                payload: 'Tavily returned null',
            });
            return null;
        }

        // Estimate tokens (rough: ~4 chars per token for result text)
        const resultText = (result.answer || '') + result.sources.map(s => s.snippet).join(' ');
        const estimatedTokens = Math.ceil(resultText.length / 4);

        // Log completion with results
        ledger.log({
            agentId,
            type: 'research_complete',
            topic: task.question,
            payload: result,
            cost: { tokens: estimatedTokens, estimatedUsd: estimateCost(estimatedTokens, 'default') },
        });

        pool.recordCall(agentId, estimatedTokens);

        return {
            question: task.question,
            answer: result.answer || 'No direct answer from search.',
            sources: result.sources.map(s => ({
                title: s.title,
                url: s.url,
                snippet: s.snippet,
            })),
            fromCache: false,
            agentId,
        };
    } catch (err) {
        ledger.log({
            agentId,
            type: 'research_failed',
            topic: task.question,
            payload: err instanceof Error ? err.message : 'Unknown error',
        });
        return null;
    }
}

/* ═══════════════════════════════════════════
   MID-TASK RESEARCH REQUEST
   ═══════════════════════════════════════════ */

/**
 * Request research from an available agent while the primary continues working.
 * Returns a promise that resolves when research is complete.
 * If no agents available, falls back to synchronous search.
 */
export async function requestMidTaskResearch(
    question: string,
    requestingAgent: string,
    pool: AgentPool,
    ledger: SharedLedger,
): Promise<string> {
    // Dedup check
    const dedup = checkDedup(ledger, question);

    if (dedup.action === 'use_cached') {
        const cached = dedup.result as TavilySearchResult;
        return formatResearchResult(cached);
    }

    if (dedup.action === 'wait') {
        const result = await waitForResearch(ledger, question, 30_000);
        if (result) return formatResearchResult(result as TavilySearchResult);
        // Timed out — fall through to do it ourselves
    }

    // Try to get a research slot
    const slot = pool.acquire('research', 'tavily');

    const result = await executeSingleResearch(
        { question, priority: 'critical', requestingAgent },
        slot?.id || 'fallback-0',
        pool,
        ledger,
    );

    if (slot) pool.release(slot.id);

    return result?.answer || `Research for "${question}" returned no results.`;
}

/** Format a Tavily result into readable text for context injection */
function formatResearchResult(result: TavilySearchResult | null): string {
    if (!result) return 'No research results available.';

    const parts: string[] = [];
    if (result.answer) parts.push(result.answer);
    if (result.sources?.length) {
        parts.push('\nSources:');
        for (const s of result.sources.slice(0, 3)) {
            parts.push(`- [${s.title}](${s.url}): ${s.snippet}`);
        }
    }
    return parts.join('\n');
}

/* ═══════════════════════════════════════════
   RESEARCH CAPABILITIES CHECK
   ═══════════════════════════════════════════ */

/** Check how many parallel research agents are available */
export function getResearchCapacity(pool: AgentPool): {
    parallel: number;
    hasTavily: boolean;
    mode: 'parallel' | 'sequential' | 'none';
} {
    const config = getProviderConfig('tavily');
    const researchSlots = pool.getResearchSlots();
    const hasTavily = !!config.apiKey;

    return {
        parallel: Math.max(researchSlots.length, hasTavily ? 1 : 0),
        hasTavily,
        mode: researchSlots.length > 1 ? 'parallel'
            : hasTavily ? 'sequential'
                : 'none',
    };
}
