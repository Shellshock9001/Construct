/* ═══════════════════════════════════════════════════════════════════
   Construct — Agent Worker

   Lightweight, single-shot LLM call for a specific role.
   Workers are NOT full agents — they make one focused call,
   return structured output, and log to the shared ledger.

   Worker Types:
   - gap_researcher:      Deep-dive a specific knowledge gap
   - architecture_reviewer: Analyze blueprint for missing pieces
   - tech_validator:      Verify library/API compatibility
   - deep_analyst:        Synthesize Tavily results into structured findings
   ═══════════════════════════════════════════════════════════════════ */

import { type AgentSlot } from './agentPool';
import {
    type SharedLedger,
    estimateCost,
} from './orchestrationLedger';
import {
    type ChatMessage,
    type ChatResult,
    type ProviderName,
    getSelectedModel,
    chatOpenAI,
    chatAnthropic,
    chatOllama,
    chatGroq,
    chatOpenRouter,
    chatGemini,
    searchTavily,
} from './providers';

/* ─── Types ─── */

export type WorkerType = 'gap_researcher' | 'architecture_reviewer' | 'tech_validator' | 'deep_analyst';

export interface WorkerTask {
    id: string;
    type: WorkerType;
    topic: string;
    context: string;          // blueprint summary, user prompt, etc.
    searchFirst?: boolean;    // search Tavily before LLM call
}

export interface WorkerResult {
    workerId: string;
    slotId: string;
    topic: string;
    type: WorkerType;
    findings: string;
    keyInsights: string[];
    codePatterns: string[];
    pitfalls: string[];
    sources: string[];
    confidence: number;
    tokensUsed: number;
    durationMs: number;
    error?: string;
}

/* ─── Role-Specific System Prompts ─── */

const WORKER_PROMPTS: Record<WorkerType, string> = {
    gap_researcher: `You are a focused technical researcher. You have been assigned ONE specific knowledge gap to fill.

Your job:
1. Analyze what this gap actually requires to solve
2. Provide CONCRETE implementation patterns (actual code, actual APIs, actual data structures)
3. Identify specific pitfalls and edge cases
4. Recommend specific libraries with their actual npm package names and versions

DO NOT give generic advice. DO NOT say "you could use X or Y." COMMIT to specific recommendations.

Respond in this exact JSON format:
{
    "findings": "Detailed technical analysis (2-4 paragraphs with specific code patterns)",
    "keyInsights": ["Insight 1: specific and actionable", "Insight 2: specific and actionable"],
    "codePatterns": ["Actual code snippet or API usage pattern 1", "Pattern 2"],
    "pitfalls": ["Specific pitfall with explanation", "Another pitfall"],
    "confidence": 0.0-1.0
}`,

    architecture_reviewer: `You are a senior architect doing a focused review of ONE aspect of a system design.

Your job:
1. Identify what's MISSING from this subsystem design
2. Find data flow gaps — where does state come from? How is it persisted?
3. Check for scalability issues and single points of failure
4. Propose specific solutions, not vague suggestions

Respond in this exact JSON format:
{
    "findings": "Architecture analysis (what's missing, what's wrong, what should change)",
    "keyInsights": ["Missing component or flow 1", "Scalability issue 2"],
    "codePatterns": ["Proposed architecture pattern 1", "Data flow fix 2"],
    "pitfalls": ["Why naive implementation fails", "Edge case that breaks at scale"],
    "confidence": 0.0-1.0
}`,

    tech_validator: `You are a technology compatibility validator. You verify that recommended technologies actually work together.

Your job:
1. Verify that the stated libraries/APIs actually exist and support the claimed features
2. Check version compatibility between recommended tools
3. Verify that the approach works for the stated platform/target
4. Flag any deprecated, abandoned, or license-problematic dependencies

Respond in this exact JSON format:
{
    "findings": "Compatibility analysis with specific version numbers and platform support details",
    "keyInsights": ["Verified: X works with Y", "CONFLICT: A is incompatible with B because..."],
    "codePatterns": ["Correct import/usage pattern", "Version constraint to use"],
    "pitfalls": ["Deprecated API that will break", "License issue with library X"],
    "confidence": 0.0-1.0
}`,

    deep_analyst: `You are a deep analyst synthesizing research data into actionable intelligence.

Given raw search results about a technical topic, synthesize them into:
1. THE specific approach to take (not multiple options — pick the best one)
2. Actual implementation steps (numbered, concrete)
3. Code patterns from real-world examples
4. What to watch out for

Respond in this exact JSON format:
{
    "findings": "Synthesized analysis — the ONE recommended approach with detailed reasoning",
    "keyInsights": ["Key finding 1", "Key finding 2"],
    "codePatterns": ["Implementation pattern from research", "API usage example"],
    "pitfalls": ["Common mistake found in research", "Version-specific issue"],
    "confidence": 0.0-1.0
}`,
};

/* ═══════════════════════════════════════════
   WORKER EXECUTION
   ═══════════════════════════════════════════ */

/**
 * Execute a single worker task. Makes one focused LLM call,
 * optionally preceded by a Tavily search for grounding data.
 * Logs everything to the ledger for dashboard visibility.
 */
export async function executeWorker(
    task: WorkerTask,
    slot: AgentSlot,
    ledger: SharedLedger,
    tavilyAvailable: boolean = false,
): Promise<WorkerResult> {
    const startTime = Date.now();
    const model = getSelectedModel(slot.provider);

    // Log worker start
    ledger.log({
        agentId: slot.id,
        type: 'agent_assigned',
        topic: `[${task.type}] ${task.topic}`,
        payload: { workerType: task.type, model, provider: slot.provider },
    });

    try {
        // Phase 1: Optional Tavily search for grounding
        let searchContext = '';
        if (task.searchFirst && tavilyAvailable) {
            try {
                const searchResult = await searchTavily(task.topic, {
                    depth: 'advanced',
                    maxResults: 4,
                });
                if (searchResult) {
                    searchContext = '\n\n## Research Data (from web search):\n';
                    if (searchResult.answer) {
                        searchContext += `Summary: ${searchResult.answer}\n\n`;
                    }
                    searchContext += searchResult.sources
                        .map(s => `- **${s.title}** (${s.url}): ${s.snippet}`)
                        .join('\n');

                    ledger.log({
                        agentId: slot.id,
                        type: 'research_complete',
                        topic: task.topic,
                        payload: { sourcesFound: searchResult.sources.length },
                    });
                }
            } catch {
                // Search failed — continue without it
                ledger.log({
                    agentId: slot.id,
                    type: 'research_failed',
                    topic: task.topic,
                    payload: 'Tavily search failed, continuing with LLM knowledge only',
                });
            }
        }

        // Phase 2: Focused LLM call
        const messages: ChatMessage[] = [
            { role: 'system', content: WORKER_PROMPTS[task.type] },
            {
                role: 'user',
                content: `## Assignment\nTopic: ${task.topic}\n\n## Context\n${task.context}${searchContext}\n\nProvide your analysis now. Remember: JSON only, no markdown wrapping.`,
            },
        ];

        const result = await callProviderDirect(slot.provider, messages, model);

        if (result.error || !result.content) {
            throw new Error(result.error || 'Empty response from worker LLM');
        }

        // Parse structured response
        const parsed = parseWorkerResponse(result.content);
        const tokens = (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0);
        const duration = Date.now() - startTime;

        // Log completion
        const usd = estimateCost(tokens, model);
        ledger.log({
            agentId: slot.id,
            type: 'research_complete',
            topic: `[${task.type}] ${task.topic}`,
            payload: {
                insightCount: parsed.keyInsights.length,
                confidence: parsed.confidence,
                durationMs: duration,
            },
            cost: { tokens, estimatedUsd: usd },
        });

        // Share key insights to the ledger for cross-agent visibility
        if (parsed.keyInsights.length > 0) {
            ledger.log({
                agentId: slot.id,
                type: 'insight_shared',
                topic: task.topic,
                payload: parsed.keyInsights.join(' | '),
            });
        }

        return {
            workerId: task.id,
            slotId: slot.id,
            topic: task.topic,
            type: task.type,
            findings: parsed.findings,
            keyInsights: parsed.keyInsights,
            codePatterns: parsed.codePatterns,
            pitfalls: parsed.pitfalls,
            sources: [],
            confidence: parsed.confidence,
            tokensUsed: tokens,
            durationMs: duration,
        };

    } catch (err) {
        const duration = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : 'Worker failed';

        ledger.log({
            agentId: slot.id,
            type: 'research_failed',
            topic: task.topic,
            payload: errorMsg,
        });

        return {
            workerId: task.id,
            slotId: slot.id,
            topic: task.topic,
            type: task.type,
            findings: '',
            keyInsights: [],
            codePatterns: [],
            pitfalls: [],
            sources: [],
            confidence: 0,
            tokensUsed: 0,
            durationMs: duration,
            error: errorMsg,
        };
    }
}

/* ─── Parse Worker JSON Response ─── */

interface ParsedWorkerOutput {
    findings: string;
    keyInsights: string[];
    codePatterns: string[];
    pitfalls: string[];
    confidence: number;
}

function parseWorkerResponse(raw: string): ParsedWorkerOutput {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        // If the response isn't JSON, treat the whole thing as findings
        return {
            findings: raw.slice(0, 2000),
            keyInsights: [],
            codePatterns: [],
            pitfalls: [],
            confidence: 0.3,
        };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            findings: String(parsed.findings || ''),
            keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights.map(String) : [],
            codePatterns: Array.isArray(parsed.codePatterns) ? parsed.codePatterns.map(String) : [],
            pitfalls: Array.isArray(parsed.pitfalls) ? parsed.pitfalls.map(String) : [],
            confidence: typeof parsed.confidence === 'number'
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.5,
        };
    } catch {
        return {
            findings: raw.slice(0, 2000),
            keyInsights: [],
            codePatterns: [],
            pitfalls: [],
            confidence: 0.3,
        };
    }
}

/* ─── Provider Call (direct, without going through main provider dispatch) ─── */

async function callProviderDirect(
    provider: ProviderName,
    messages: ChatMessage[],
    model: string,
): Promise<ChatResult> {
    const options = { model, temperature: 0.2, maxTokens: 2048 };

    switch (provider) {
        case 'gemini': return chatGemini(messages, options);
        case 'openai': return chatOpenAI(messages, options);
        case 'anthropic': return chatAnthropic(messages, options);
        case 'groq': return chatGroq(messages, options);
        case 'openrouter': return chatOpenRouter(messages, options);
        case 'ollama': return chatOllama(messages, options);
        default: return { content: '', model, provider, error: `Unknown provider: ${provider}` };
    }
}
