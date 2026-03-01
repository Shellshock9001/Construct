/* ═══════════════════════════════════════════════════════════════════
   Construct — Agent Dispatcher

   The brain that coordinates parallel multi-agent work.

   Two entry points:
   1. Pre-flight dispatch — when pre-flight intelligence finds gaps,
      dispatches workers across available slots in parallel
   2. Mid-task dispatch — when primary agent discovers a new gap,
      spawns a background worker without blocking the main loop

   Graceful degradation:
   - 0 extra keys → no dispatch (primary does everything)
   - 1 extra key  → sequential worker calls
   - 2+ extra keys → true parallel dispatch
   ═══════════════════════════════════════════════════════════════════ */

import { pool, type AgentSlot } from './agentPool';
import { ledger } from './orchestrationLedger';
import {
    executeWorker,
    type WorkerTask,
    type WorkerResult,
    type WorkerType,
} from './agentWorker';
import type { AppBlueprint, IntelligenceAssessment } from './autonomousIntelligence';
import { getProviderConfig } from './providers';

// Local type to avoid circular dependency with agentCore
interface AgentStep {
    id: string;
    type: "thinking" | "tool_call" | "tool_result" | "response" | "error" | "plan";
    content: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: { success: boolean; output: string; error?: string };
    timestamp: number;
}

/* ─── Types ─── */

export interface DispatchResult {
    /** Merged context string for injection into primary agent's system prompt */
    mergedContext: string;
    /** Individual worker results for granular inspection */
    workerResults: WorkerResult[];
    /** Total tokens consumed across all workers */
    totalTokens: number;
    /** Total time for all workers (parallel = max, not sum) */
    wallClockMs: number;
    /** Number of workers dispatched */
    workersDispatched: number;
    /** Number that completed successfully */
    workersSucceeded: number;
}

/* ═══════════════════════════════════════════
   PRE-FLIGHT PARALLEL DISPATCH

   Called after pre-flight intelligence identifies gaps.
   Dispatches one worker per gap across available LLM slots.
   ═══════════════════════════════════════════ */

/**
 * Dispatch parallel workers for each critical gap identified by pre-flight intelligence.
 * Uses available LLM slots — each worker gets a different API key/provider.
 * Returns merged context ready for injection into the primary agent's system prompt.
 */
export async function dispatchPreFlightWorkers(
    gaps: string[],
    blueprint: AppBlueprint,
    assessment: IntelligenceAssessment,
    emitStep: (step: AgentStep) => void,
): Promise<DispatchResult> {
    const startTime = Date.now();

    // Get available LLM slots (exclude the primary — it's reserved for the main agent)
    const availableSlots = pool.getLLMSlots().filter(s => s.role !== 'primary');

    if (availableSlots.length === 0) {
        // No extra slots — graceful degradation
        emitStep({
            id: `dispatch-skip-${Date.now()}`,
            type: 'thinking',
            content: 'No additional agent slots available. Primary agent will handle all gaps.',
            timestamp: Date.now(),
        });
        return {
            mergedContext: '',
            workerResults: [],
            totalTokens: 0,
            wallClockMs: 0,
            workersDispatched: 0,
            workersSucceeded: 0,
        };
    }

    // Check if Tavily is available for search-augmented research
    const tavilyConfig = getProviderConfig('tavily');
    const hasTavily = !!tavilyConfig.apiKey;

    // Build worker tasks from gaps + blueprint context
    const tasks = buildWorkerTasks(gaps, blueprint, assessment);

    const uniqueProviders = availableSlots.reduce((acc, s) => { acc[s.provider] = true; return acc; }, {} as Record<string, boolean>);
    const providerCount = Object.keys(uniqueProviders).length;

    emitStep({
        id: `dispatch-start-${Date.now()}`,
        type: 'thinking',
        content: `Dispatching ${Math.min(tasks.length, availableSlots.length)} parallel research workers across ${providerCount} providers`,
        timestamp: Date.now(),
    });

    // Assign tasks to slots (round-robin across available slots)
    const assignments: Array<{ task: WorkerTask; slot: AgentSlot }> = [];
    for (let i = 0; i < tasks.length; i++) {
        const slot = availableSlots[i % availableSlots.length];
        // Mark slot busy
        const acquiredSlot = pool.acquire(slot.role, slot.provider);
        if (acquiredSlot) {
            acquiredSlot.currentTask = tasks[i].topic;
            assignments.push({ task: tasks[i], slot: acquiredSlot });

            emitStep({
                id: `worker-assigned-${Date.now()}-${i}`,
                type: 'tool_call',
                toolName: 'agent_worker',
                toolArgs: { worker: acquiredSlot.id, type: tasks[i].type, topic: tasks[i].topic },
                content: `Worker ${acquiredSlot.id} (${acquiredSlot.provider}) → ${tasks[i].type}: ${tasks[i].topic}`,
                timestamp: Date.now(),
            });
        }
    }

    if (assignments.length === 0) {
        return {
            mergedContext: '',
            workerResults: [],
            totalTokens: 0,
            wallClockMs: Date.now() - startTime,
            workersDispatched: 0,
            workersSucceeded: 0,
        };
    }

    // Execute all workers in parallel
    const workerPromises = assignments.map(({ task, slot }) =>
        executeWorker(task, slot, ledger, hasTavily)
            .finally(() => {
                pool.release(slot.id);
                slot.currentTask = undefined;
            })
    );

    const results = await Promise.allSettled(workerPromises);
    const workerResults: WorkerResult[] = [];

    for (const result of results) {
        if (result.status === 'fulfilled') {
            workerResults.push(result.value);

            const r = result.value;
            if (!r.error) {
                emitStep({
                    id: `worker-done-${Date.now()}-${r.workerId}`,
                    type: 'tool_result',
                    toolName: 'agent_worker',
                    content: `Worker ${r.slotId} completed: ${r.keyInsights.length} insights, confidence: ${Math.round(r.confidence * 100)}%`,
                    toolResult: { success: true, output: r.findings.slice(0, 200) },
                    timestamp: Date.now(),
                });
            } else {
                emitStep({
                    id: `worker-fail-${Date.now()}-${r.workerId}`,
                    type: 'tool_result',
                    toolName: 'agent_worker',
                    content: `Worker ${r.slotId} failed: ${r.error}`,
                    toolResult: { success: false, output: '', error: r.error },
                    timestamp: Date.now(),
                });
            }
        }
    }

    const succeeded = workerResults.filter(r => !r.error);
    const totalTokens = workerResults.reduce((sum, r) => sum + r.tokensUsed, 0);
    const wallClockMs = Date.now() - startTime;

    // Merge results into context
    const mergedContext = aggregateWorkerResults(succeeded);

    emitStep({
        id: `dispatch-complete-${Date.now()}`,
        type: 'thinking',
        content: `Parallel research complete: ${succeeded.length}/${assignments.length} workers succeeded, ${totalTokens} tokens, ${wallClockMs}ms`,
        timestamp: Date.now(),
    });

    return {
        mergedContext,
        workerResults,
        totalTokens,
        wallClockMs,
        workersDispatched: assignments.length,
        workersSucceeded: succeeded.length,
    };
}

/* ═══════════════════════════════════════════
   MID-TASK BACKGROUND DISPATCH

   Spawns a worker without blocking the primary agent.
   Results flow into the ledger → dashboard shows them live.
   Next agent iteration picks up insights via awareness context.
   ═══════════════════════════════════════════ */

/**
 * Dispatch a background research worker for a specific question.
 * Non-blocking — returns immediately with a promise.
 * Results are logged to the ledger, which the primary agent reads
 * via awareness context on the next iteration.
 */
export function dispatchMidTaskWorker(
    question: string,
    emitStep: (step: AgentStep) => void,
): { dispatched: boolean; slotId: string | null } {
    const slot = pool.acquire('research');
    if (!slot) {
        // No available slot — caller should fall back to synchronous
        return { dispatched: false, slotId: null };
    }

    const tavilyConfig = getProviderConfig('tavily');
    const hasTavily = !!tavilyConfig.apiKey;

    const task: WorkerTask = {
        id: `midtask-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: 'gap_researcher',
        topic: question,
        context: `Mid-task research request. The primary agent encountered this gap while building and needs specific, actionable information to proceed.`,
        searchFirst: hasTavily,
    };

    slot.currentTask = question.slice(0, 50);

    emitStep({
        id: `midtask-dispatch-${Date.now()}`,
        type: 'tool_call',
        toolName: 'agent_worker',
        toolArgs: { worker: slot.id, topic: question },
        content: `Background research dispatched to ${slot.id} (${slot.provider}): ${question}`,
        timestamp: Date.now(),
    });

    // Fire and forget — results go to ledger
    executeWorker(task, slot, ledger, hasTavily)
        .then(result => {
            if (!result.error) {
                emitStep({
                    id: `midtask-done-${Date.now()}`,
                    type: 'tool_result',
                    toolName: 'agent_worker',
                    content: `Background worker ${slot.id} completed: ${result.keyInsights.length} insights found`,
                    toolResult: { success: true, output: result.findings.slice(0, 300) },
                    timestamp: Date.now(),
                });
            }
        })
        .catch(() => {
            pool.markError(slot.id);
        })
        .finally(() => {
            pool.release(slot.id);
            slot.currentTask = undefined;
        });

    return { dispatched: true, slotId: slot.id };
}

/* ═══════════════════════════════════════════
   TASK GENERATION

   Converts gaps + blueprint into concrete worker tasks.
   Not just "research X" — creates targeted assignments.
   ═══════════════════════════════════════════ */

function buildWorkerTasks(
    gaps: string[],
    blueprint: AppBlueprint,
    assessment: IntelligenceAssessment,
): WorkerTask[] {
    const tasks: WorkerTask[] = [];
    const blueprintContext = `App: ${blueprint.appDescription}\nSubsystems: ${blueprint.subsystems.join(', ')}\nArchitecture: ${blueprint.architecture}\nComplexity: ${blueprint.complexity}`;

    // 1. One gap_researcher per critical gap
    for (const gap of gaps.slice(0, 6)) { // Max 6 gap researchers
        tasks.push({
            id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type: 'gap_researcher',
            topic: gap,
            context: blueprintContext,
            searchFirst: true, // Search first, then synthesize
        });
    }

    // 2. Architecture reviewer for complex/expert apps
    if (blueprint.complexity === 'complex' || blueprint.complexity === 'expert') {
        // Find the lowest-confidence subsystems
        const weakSubs = assessment.subsystemAssessments
            .filter(s => s.confidence === 'low' || s.confidence === 'none')
            .slice(0, 2);

        if (weakSubs.length > 0) {
            tasks.push({
                id: `arch-${Date.now()}`,
                type: 'architecture_reviewer',
                topic: `Architecture review for weak subsystems: ${weakSubs.map(s => s.name).join(', ')}`,
                context: `${blueprintContext}\n\nWeakest subsystems:\n${weakSubs.map(s => `- ${s.name}: ${s.reasoning}\n  Gaps: ${s.gapsInKnowledge.join(', ')}`).join('\n')}`,
                searchFirst: false,
            });
        }
    }

    // 3. Tech validator if there are specific libraries
    if (blueprint.libraries.length > 3) {
        tasks.push({
            id: `techval-${Date.now()}`,
            type: 'tech_validator',
            topic: `Verify compatibility: ${blueprint.libraries.slice(0, 5).join(', ')}`,
            context: `${blueprintContext}\n\nLibraries to validate:\n${blueprint.libraries.map(l => `- ${l}`).join('\n')}\n\nRequired capabilities:\n${blueprint.capabilities.map(c => `- ${c}`).join('\n')}`,
            searchFirst: true,
        });
    }

    return tasks;
}

/* ═══════════════════════════════════════════
   RESULT AGGREGATION

   Merges worker outputs into a single context string
   for injection into the primary agent's system prompt.
   Deduplicates, prioritizes high-confidence results.
   ═══════════════════════════════════════════ */

function aggregateWorkerResults(results: WorkerResult[]): string {
    if (results.length === 0) return '';

    // Sort by confidence — highest first
    const sorted = [...results].sort((a, b) => b.confidence - a.confidence);

    const sections: string[] = [];
    sections.push(`\n## Multi-Agent Research Results (${results.length} workers)`);

    // Deduplicate insights across workers
    const allInsights = new Set<string>();
    const allPitfalls = new Set<string>();
    const allPatterns: string[] = [];

    for (const r of sorted) {
        // Per-worker summary
        const confLabel = r.confidence >= 0.7 ? 'HIGH' :
            r.confidence >= 0.4 ? 'MEDIUM' : 'LOW';

        sections.push(`### [${r.type}] ${r.topic} — ${confLabel} confidence (${Math.round(r.confidence * 100)}%)`);

        if (r.findings) {
            sections.push(r.findings.slice(0, 800));
        }

        // Collect deduped insights
        for (const insight of r.keyInsights) {
            const normalized = insight.toLowerCase().trim();
            if (!allInsights.has(normalized)) {
                allInsights.add(normalized);
            }
        }

        for (const pitfall of r.pitfalls) {
            const normalized = pitfall.toLowerCase().trim();
            if (!allPitfalls.has(normalized)) {
                allPitfalls.add(normalized);
            }
        }

        for (const pattern of r.codePatterns) {
            if (pattern.length > 10 && !allPatterns.some(p =>
                p.toLowerCase().includes(pattern.toLowerCase().slice(0, 30))
            )) {
                allPatterns.push(pattern);
            }
        }
    }

    // Unified insights section
    if (allInsights.size > 0) {
        sections.push(`\n### Key Insights (across all workers)`);
        const insightsArr = Array.from(allInsights);
        for (let i = 0; i < Math.min(insightsArr.length, 10); i++) {
            sections.push(`- ${insightsArr[i]}`);
        }
    }

    if (allPatterns.length > 0) {
        sections.push(`\n### Implementation Patterns`);
        for (const pattern of allPatterns.slice(0, 6)) {
            sections.push(`- ${pattern}`);
        }
    }

    if (allPitfalls.size > 0) {
        sections.push(`\n### Pitfalls to Avoid`);
        const pitfallsArr = Array.from(allPitfalls);
        for (let i = 0; i < Math.min(pitfallsArr.length, 5); i++) {
            sections.push(`- WARNING: ${pitfallsArr[i]}`);
        }
    }

    return sections.join('\n');
}
