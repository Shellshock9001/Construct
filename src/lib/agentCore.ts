/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Agent Core (ReAct Loop)
   
   Implements the Think → Plan → Act → Observe → Verify → Reflect
   cycle. The agent receives a user prompt, reasons about it, decides
   which tools to call, executes them, and iterates until the task
   is complete.
   ═══════════════════════════════════════════════════════════════════ */

import {
    type ChatMessage,
    type ChatResult,
    type ProviderName,
    getProviderConfig,
    getSelectedModel,
    chatOpenAI,
    chatAnthropic,
    chatOllama,
    chatGroq,
    chatOpenRouter,
    chatGemini,
    searchTavily,
} from "./providers";
import { identifySkills, buildSkillContext } from "./skillsKnowledge";
import { researchDocs, formatDocResult } from "./researchDocs";
import {
    runPreFlightIntelligence,
    deepResearch,
    type PreFlightIntelligence,
} from "./autonomousIntelligence";
import { pool } from "./agentPool";
import {
    ledger,
    buildAwarenessContext,
    checkDedup,
    waitForResearch,
    estimateCost,
} from "./orchestrationLedger";
import { requestMidTaskResearch, getResearchCapacity } from "./parallelResearch";
import { crossValidate, shouldValidate } from "./crossValidator";
import { dispatchPreFlightWorkers, dispatchMidTaskWorker } from "./agentDispatcher";

/* ─── Types ─── */

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, {
        type: string;
        description: string;
        required?: boolean;
        enum?: string[];
    }>;
}

export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
}

export interface ToolResult {
    success: boolean;
    output: string;
    error?: string;
}

export interface AgentStep {
    id: string;
    type: "thinking" | "tool_call" | "tool_result" | "response" | "error" | "plan";
    content: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: ToolResult;
    timestamp: number;
}

export interface AgentState {
    steps: AgentStep[];
    isRunning: boolean;
    currentStep: string;
    error?: string;
}

/* ═══════════════════════════════════════════
   TOOL DEFINITIONS
   ═══════════════════════════════════════════ */

export const TOOLS: ToolDefinition[] = [
    {
        name: "create_file",
        description: "Create a new file with the specified content. Creates parent directories automatically.",
        parameters: {
            path: { type: "string", description: "File path relative to workspace root", required: true },
            content: { type: "string", description: "File content to write", required: true },
        },
    },
    {
        name: "read_file",
        description: "Read the contents of a file.",
        parameters: {
            path: { type: "string", description: "File path relative to workspace root", required: true },
        },
    },
    {
        name: "edit_file",
        description: "Edit a file by replacing a specific search string with new content.",
        parameters: {
            path: { type: "string", description: "File path relative to workspace root", required: true },
            search: { type: "string", description: "Exact string to find in the file", required: true },
            replace: { type: "string", description: "String to replace the search match with", required: true },
        },
    },
    {
        name: "delete_file",
        description: "Delete a file from the workspace.",
        parameters: {
            path: { type: "string", description: "File path relative to workspace root", required: true },
        },
    },
    {
        name: "list_directory",
        description: "List all files and subdirectories in a directory.",
        parameters: {
            path: { type: "string", description: "Directory path relative to workspace root. Use '.' for root.", required: true },
        },
    },
    {
        name: "search_files",
        description: "Search for a text pattern across all files in a directory (like grep).",
        parameters: {
            path: { type: "string", description: "Directory to search in, relative to workspace root", required: true },
            pattern: { type: "string", description: "Text pattern to search for", required: true },
        },
    },
    {
        name: "run_command",
        description: "Run a terminal command (npm, node, git, etc). Use for installing dependencies, running builds, tests, etc.",
        parameters: {
            command: { type: "string", description: "The shell command to execute", required: true },
            cwd: { type: "string", description: "Working directory relative to workspace root. Defaults to root.", required: false },
        },
    },
    {
        name: "create_project",
        description: "Scaffold a new project from a template (react, nextjs, express, etc).",
        parameters: {
            name: { type: "string", description: "Project name (also used as directory name)", required: true },
            template: { type: "string", description: "Project template", required: true, enum: ["react", "vite-react", "nextjs", "express", "html"] },
        },
    },
    {
        name: "web_search",
        description: "Search the web for information using Tavily. Use for looking up documentation, APIs, or current info.",
        parameters: {
            query: { type: "string", description: "Search query", required: true },
        },
    },
    {
        name: "research_docs",
        description: "Research official documentation for a specific technology, library, or API. Returns cached results for repeated queries. Use this when you need to verify an API exists, check correct usage, or learn about a library.",
        parameters: {
            topic: { type: "string", description: "What to research (e.g., 'React useEffect cleanup', 'Prisma findMany with relations')", required: true },
            framework: { type: "string", description: "Target framework/library for narrowing search (e.g., 'react', 'nextjs', 'prisma')", required: false },
        },
    },
    /* ── Project Intelligence Tools ── */
    {
        name: "scan_project",
        description: "Scan the entire workspace to build a project map: file tree, exported symbols, dependency graph, and conventions. ALWAYS call this FIRST before editing an existing project. Returns compressed context.",
        parameters: {},
    },
    {
        name: "find_symbol",
        description: "Search for exported functions, types, classes, components, or constants across the project. Use this to verify a variable exists before using it. Requires scan_project to have been called first.",
        parameters: {
            query: { type: "string", description: "Symbol name to search for (e.g., 'ChatMessage', 'useAuth', 'handleSubmit')", required: true },
        },
    },
    {
        name: "check_imports",
        description: "Check what a file imports and exports, and what other files depend on it. Use before editing a file to understand impact.",
        parameters: {
            path: { type: "string", description: "File path relative to workspace root", required: true },
        },
    },
    {
        name: "analyze_architecture",
        description: "Get a high-level architecture analysis: project structure, dependency hotspots, conventions, and a pre-flight reminder. Use for complex tasks.",
        parameters: {},
    },
    /* ── Autonomous Intelligence Tools ── */
    {
        name: "detect_environment",
        description: "Detect installed tools (Node, Python, Docker, Git, Rust, Go, Ollama), scan available ports, and list running services. Call this at the start of any project that needs infrastructure.",
        parameters: {},
    },
    {
        name: "start_services",
        description: "Auto-detect and start required infrastructure services (PostgreSQL, Redis, MongoDB, RabbitMQ, etc) using Docker. Automatically assigns non-colliding ports and generates .env with connection strings.",
        parameters: {
            services: { type: "string", description: "Comma-separated service IDs to start (postgres, redis, mongodb, rabbitmq, nats, minio). If empty, auto-detects from package.json.", required: false },
        },
    },
    {
        name: "deep_research",
        description: "Research a SPECIFIC question or capability in depth. Returns detailed findings from documentation, code examples, and real-world implementations. Use when you encounter something you're unsure about mid-task, NOT for generic topics. Ask specific questions like 'how to implement frame-accurate video seeking with WebCodecs API' not 'video best practices'. Your pre-flight intelligence already analyzed the app — use this for GAPS you discover while building.",
        parameters: {
            question: { type: "string", description: "Specific technical question to research (e.g., 'how to implement WebSocket room-based matchmaking in Node.js')", required: true },
        },
    },
    {
        name: "self_assess",
        description: "Get an intelligence report — skill coverage, success rate, build pass rate, known weaknesses, and recent learnings. Use to understand your own capabilities and limitations for the current task.",
        parameters: {},
    },
    {
        name: "health_check",
        description: "Check the health status of all running infrastructure services. Reports which services are running, stopped, or erroring.",
        parameters: {},
    },
    {
        name: "task_complete",
        description: "Signal that the current task is complete. Include a final summary of what was done. WARNING: This will be REJECTED if you have not actually created files, or if critical gaps exist that you haven't researched. You must do real work before calling this.",
        parameters: {
            summary: { type: "string", description: "Summary of what was accomplished — must reference actual files created/edited", required: true },
        },
    },
];

/* ═══════════════════════════════════════════
   SYSTEM PROMPT — AGENT BRAIN
   ═══════════════════════════════════════════ */

function buildAgentSystemPrompt(
    workspace: string,
    userPrompt: string,
    intelligence?: PreFlightIntelligence,
): string {
    const toolDocs = TOOLS.map(t => {
        const params = Object.entries(t.parameters)
            .map(([k, v]) => `  - ${k} (${v.type}${v.required ? ", required" : ""}): ${v.description}`)
            .join("\n");
        return `### ${t.name}\n${t.description}\nParameters:\n${params}`;
    }).join("\n\n");

    // If we have deep intelligence, use it. Otherwise fall back to basic skill matching.
    const intelligenceSection = intelligence
        ? intelligence.contextForPrompt
        : (() => {
            const matched = identifySkills(userPrompt);
            return matched.length > 0
                ? `## Loaded Skills\n${matched.map(s => `- **${s.name}**: ${s.corePatterns.slice(0, 200)}`).join("\n")}`
                : "";
        })();

    const confidenceWarning = intelligence
        ? (intelligence.assessment.overallConfidence < 0.4
            ? `\n\n> **MANDATORY RESEARCH REQUIRED** — Confidence: ${Math.round(intelligence.assessment.overallConfidence * 100)}%\n` +
            `> You MUST call \`deep_research\` for EACH critical gap below BEFORE writing implementation code.\n` +
            `> You may NOT call \`task_complete\` until these gaps are researched and resolved.\n` +
            `> CRITICAL GAPS TO RESEARCH:\n` +
            intelligence.assessment.criticalGaps.slice(0, 5).map(g => `> - ${g}`).join('\n')
            : intelligence.assessment.overallConfidence < 0.7
                ? `\n> MODERATE CONFIDENCE (${Math.round(intelligence.assessment.overallConfidence * 100)}%). ` +
                `Use \`deep_research\` for specific questions when you hit unknowns. Do not guess.`
                : `\n> HIGH CONFIDENCE (${Math.round(intelligence.assessment.overallConfidence * 100)}%). ` +
                `Deep analysis complete. Build with conviction.`)
        : "";

    // Generate subsystem build mandate for complex/expert apps
    const subsystemMandate = (intelligence?.blueprint.subsystemSpecs?.length ?? 0) > 0
        ? (() => {
            const specs = intelligence!.blueprint.subsystemSpecs;
            // Topological sort by dependencies — subsystems with no deps come first
            const sorted = [...specs].sort((a, b) => {
                if (a.dependsOn.includes(b.name)) return 1;
                if (b.dependsOn.includes(a.name)) return -1;
                return 0;
            });
            return `\n\n## SUBSYSTEM BUILD ORDER (MANDATORY)\nYou MUST build each subsystem in order. For EACH subsystem:\n1. If confidence is LOW/NONE, call \`deep_research\` with SPECIFIC questions about the critical logic\n2. Create ALL files listed in the spec\n3. Implement ALL interfaces and data models\n4. Get the critical logic RIGHT — the spec tells you exactly what to implement\n5. Do NOT move to the next subsystem until the current one is complete\n6. Do NOT skip any subsystem — ALL must be built\n\n${sorted.map((spec, i) => {
                let entry = `### Subsystem ${i + 1}: ${spec.name}\n**Purpose:** ${spec.purpose}\n**Files to create:** ${spec.files.join(', ')}`;
                if (spec.interfaces.length > 0) entry += `\n**Interfaces:** ${spec.interfaces.join(', ')}`;
                if (spec.dataModels.length > 0) entry += `\n**Data Models:** ${spec.dataModels.join(', ')}`;
                if (spec.criticalLogic && spec.criticalLogic !== 'Needs detailed specification') {
                    entry += `\n**CRITICAL — Must get right:** ${spec.criticalLogic}`;
                }
                if (spec.dependsOn.length > 0) entry += `\n**Depends on:** ${spec.dependsOn.join(', ')}`;
                return entry;
            }).join('\n\n')}`;
        })()
        : "";

    return `You are **ShellShockHive**, an AI-powered expert coding agent built to produce code that surpasses what human senior engineers write. You don't just follow best practices — you innovate with AI-powered features and patterns that no other tool provides.

## Workspace
All files are relative to: ${workspace}

## Available Tools
You can call tools by outputting JSON in this exact format:
\`\`\`tool
{"name": "tool_name", "args": {"param1": "value1"}}
\`\`\`

${toolDocs}

${intelligenceSection}${confidenceWarning}

## 🧠 Deep Autonomous Intelligence
You are not a basic agent. Before this conversation started, your intelligence system already:
1. **Decomposed** the user's request into specific subsystems, capabilities, and libraries using AI reasoning
2. **Researched** each capability via real documentation and code examples
3. **Honestly assessed** your confidence per-subsystem, identifying gaps in your knowledge

The blueprint, research findings, and self-assessment above ARE your awareness. Use them:
- **Follow the blueprint** — it tells you WHAT to build and HOW to architect it
- **Use the research findings** — they contain real patterns, pitfalls, and library recommendations
- **Respect your confidence levels** — for LOW/NONE subsystems, use \`deep_research\` before writing code
- **Discover new gaps** — as you build, when you realize you need something you don't know, call \`deep_research\` with a SPECIFIC question

### Infrastructure Intelligence
- Before starting ANY project that needs databases, caches, or services:
  1. Call \`detect_environment\` to know what tools are available and which ports are free
  2. Call \`start_services\` to auto-start required infrastructure with non-colliding ports
  3. Call \`health_check\` to verify services are ready before using them
- NEVER hardcode ports — always use assigned ports from \`start_services\`

### Project Intelligence (CRITICAL)
Most AI agents create duplicate files, use invalid variables, and break project structure.
You have tools to PREVENT this. USE THEM.

#### Before working on an EXISTING project:
1. Call \`scan_project\` FIRST — full file tree, all exported symbols, import chains, conventions.
2. NEVER create a file without checking if it already exists in the scan results.
3. NEVER use a variable, function, or type without verifying via \`find_symbol\`.
4. BEFORE editing a file, call \`check_imports\` to understand what depends on it.
5. For complex tasks, call \`analyze_architecture\` to understand dependency hotspots.

## Expert Workflow (Chain-of-Thought)
1. **REVIEW INTELLIGENCE**: Read the blueprint, research, and self-assessment above. Internalize the architecture.
2. **SCAN**: If working on an existing project, call \`scan_project\` to understand the full structure
3. **PLAN**: Output a detailed architecture plan that follows the blueprint. Include:
   - How each subsystem maps to files/modules
   - Key design decisions informed by the research findings
   - Which subsystems you're confident about vs. which need more research
4. **RESEARCH GAPS**: For any subsystem where your confidence is LOW or NONE, call \`deep_research\` with specific questions
5. **BUILD**: Create/edit files one at a time. Write production-quality code:
   - Full TypeScript strict mode compliance
   - Comprehensive error handling (try/catch, error boundaries)
   - Input validation on all external data
   - Accessibility (ARIA, keyboard nav, screen readers)
6. **VERIFY**: After creating files, run \`npm install\` and \`npm run build\`
7. **FIX**: If build fails, analyze the error, fix it, and rebuild. Never give up.
8. **COMPLETE**: Call task_complete with a detailed summary

## Code Quality Standards
- TypeScript strict mode, no \`any\` types (use \`unknown\` and narrow)
- Every function has error handling
- Every external input is validated
- Use const by default, let only when reassigning
- Named exports, barrel files for clean imports
- Semantic HTML, WCAG compliance
- Mobile-first responsive design
- Environment variables in .env, never hardcoded secrets
- Comments for WHY, not WHAT
- Match existing project conventions (naming, structure, styling)

## AI-Powered Features (What Makes Us Different)
Always look for opportunities to add these unique capabilities:
- **Smart Defaults**: Infer configuration from project structure
- **Error Recovery**: Components that detect, report, and self-heal errors
- **Auto-Optimization**: Lazy loading, code splitting, caching — baked in
- **Accessibility Automation**: ARIA roles, focus management, contrast checks
- **Type Safety All the Way**: End-to-end type safety from DB to UI
- **Progressive Enhancement**: Works without JS, gets better with it

## Response Format
Mix clear explanations with tool calls. Always explain your reasoning.
Start by reviewing the intelligence above, then proceed with your plan.

## Anti-Hallucination Rules (ABSOLUTE — VIOLATION = FAILURE)
- NEVER claim you "created" or "built" something unless you actually called create_file for it
- NEVER call task_complete if you only described what COULD be built — you must have created actual files
- NEVER recommend competing technologies for the same role (e.g., Unity + Phaser, React + Angular)
- NEVER ignore your own critical gaps — if your assessment says "low confidence" on a subsystem, you MUST research it before coding it
- NEVER claim a project is "complete" when you've only created a plan or description
- If confidence < 50% and critical gaps exist, you MUST call deep_research for each gap BEFORE any create_file calls
- task_complete will be REJECTED if: (a) 0 files were created, or (b) critical gaps exist with 0 research calls made

## What "Intelligence" Actually Means
You are not intelligent by listing what needs to be built. A blog post can do that.
You are intelligent when you:
1. Research gaps deeply before coding (not after, not "as we go")
2. Produce specific, working implementations (not generic outlines)
3. Catch your own contradictions (competing tech, impossible timelines)
4. Know the difference between "I described it" and "I built it"
5. Flag legal/IP risks that humans would miss
6. Architecture decisions are backed by research, not guesses`;
}

/* ═══════════════════════════════════════════
   TOOL EXECUTION
   ═══════════════════════════════════════════ */

// In-memory state for tracking
let __infraPortAssignments: Record<string, number> = {};

async function executeTool(call: ToolCall, workspace: string): Promise<ToolResult> {
    // ── Autonomous Intelligence Tools (server-side via API) ──
    if (call.name === "detect_environment" || call.name === "start_services" || call.name === "health_check" || call.name === "self_assess") {
        try {
            const response = await fetch("/api/tools", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tool: call.name,
                    args: { ...call.args, workspace },
                }),
            });
            const data = await response.json();
            if (!data.success) {
                return { success: false, output: "", error: data.error || "Tool failed" };
            }
            // Cache infrastructure port assignments for health checks
            if (call.name === "start_services" && data.portAssignments) {
                __infraPortAssignments = data.portAssignments;
            }
            return { success: true, output: data.output || data.summary || JSON.stringify(data, null, 2) };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Tool failed";
            return { success: false, output: "", error: msg };
        }
    }

    // deep_research — mid-task research for specific questions (dedup-aware)
    // Tries background worker dispatch first, falls back to synchronous
    if (call.name === "deep_research") {
        try {
            const question = call.args.question as string;

            // Check dedup before researching
            const dedup = checkDedup(ledger, question);
            if (dedup.action === 'use_cached') {
                return { success: true, output: `[CACHED] ${typeof dedup.result === 'string' ? dedup.result : JSON.stringify(dedup.result)}` };
            }
            if (dedup.action === 'wait') {
                const waitResult = await waitForResearch(ledger, question, 20_000);
                if (waitResult) {
                    return { success: true, output: `[FROM AGENT ${dedup.agentId}] ${typeof waitResult === 'string' ? waitResult : JSON.stringify(waitResult)}` };
                }
            }

            // Try dispatching to a background worker (non-blocking)
            // Note: we need a reference to emitStep here, but executeTool doesn't have it.
            // So we fall through to synchronous research. The background dispatch
            // is handled at the dispatchPreFlightWorkers level instead.

            // Log research start
            ledger.log({ agentId: 'primary-0', type: 'research_started', topic: question, payload: null });

            const result = await deepResearch(question, searchTavily);

            // Log research complete
            ledger.log({
                agentId: 'primary-0',
                type: 'research_complete',
                topic: question,
                payload: result,
                cost: { tokens: Math.ceil(result.length / 4), estimatedUsd: estimateCost(Math.ceil(result.length / 4)) },
            });

            return { success: true, output: result };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Research failed";
            ledger.log({ agentId: 'primary-0', type: 'research_failed', topic: call.args.question as string, payload: msg });
            return { success: false, output: "", error: msg };
        }
    }

    // Web search via Tavily (dedup-aware)
    if (call.name === "web_search") {
        try {
            const query = call.args.query as string;

            // Check dedup
            const dedup = checkDedup(ledger, query);
            if (dedup.action === 'use_cached') {
                const cached = dedup.result as any;
                return { success: true, output: `[CACHED] ${cached?.answer || JSON.stringify(cached)}` };
            }

            ledger.log({ agentId: 'primary-0', type: 'research_started', topic: query, payload: null });

            const result = await searchTavily(query, { depth: "advanced", maxResults: 5 });
            if (!result) {
                ledger.log({ agentId: 'primary-0', type: 'research_failed', topic: query, payload: 'Tavily returned null' });
                return { success: false, output: "", error: "Tavily search failed — check API key in Settings" };
            }

            const sourceSummaries = result.sources.map(s => `- [${s.title}](${s.url}): ${s.snippet}`).join("\n");
            const output = `${result.answer || "No direct answer"}\n\nSources:\n${sourceSummaries}`;

            ledger.log({
                agentId: 'primary-0',
                type: 'research_complete',
                topic: query,
                payload: result,
                cost: { tokens: Math.ceil(output.length / 4), estimatedUsd: estimateCost(Math.ceil(output.length / 4)) },
            });

            return { success: true, output };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Search failed";
            return { success: false, output: "", error: msg };
        }
    }

    // Documentation research via Tavily with caching
    if (call.name === "research_docs") {
        try {
            const result = await researchDocs(
                call.args.topic as string,
                { framework: call.args.framework as string | undefined, depth: 'advanced' }
            );
            return { success: true, output: formatDocResult(result) };
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Research failed";
            return { success: false, output: "", error: msg };
        }
    }

    // Task complete is a signal, not a real tool
    if (call.name === "task_complete") {
        return { success: true, output: call.args.summary as string };
    }

    // All other tools go to the server-side API
    try {
        const response = await fetch("/api/tools", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tool: call.name,
                args: { ...call.args, workspace },
            }),
        });

        const data = await response.json();
        if (!data.success) {
            return { success: false, output: "", error: data.error || "Tool failed" };
        }

        // Format output based on tool
        let output = "";
        switch (call.name) {
            case "create_file":
                output = `✓ Created ${call.args.path}`;
                break;
            case "read_file":
                output = data.content || "";
                break;
            case "edit_file":
                output = `✓ Edited ${call.args.path}`;
                break;
            case "delete_file":
                output = `✓ Deleted ${call.args.path}`;
                break;
            case "list_directory":
                output = (data.items || [])
                    .map((i: { type: string; name: string; size?: number }) =>
                        `${i.type === "directory" ? "📁" : "📄"} ${i.name}${i.size ? ` (${(i.size / 1024).toFixed(1)}KB)` : ""}`)
                    .join("\n");
                break;
            case "search_files":
                output = data.results?.length
                    ? data.results.map((r: { file: string; line: number; content: string }) =>
                        `${r.file}:${r.line} — ${r.content}`).join("\n")
                    : "No matches found";
                break;
            case "run_command":
                output = [
                    `$ ${call.args.command}`,
                    data.stdout,
                    data.stderr ? `STDERR: ${data.stderr}` : "",
                    `Exit code: ${data.exitCode}`,
                ].filter(Boolean).join("\n");
                break;
            case "create_project":
                output = `✓ Created ${call.args.template} project "${call.args.name}" with files:\n${(data.files || []).join("\n")}`;
                break;
            /* ── Project Intelligence outputs ── */
            case "scan_project":
                output = data.context || JSON.stringify(data, null, 2);
                break;
            case "find_symbol":
                output = data.results?.length
                    ? `Found ${data.total} matches for "${data.query}":\n` +
                    data.results.map((r: { name: string; kind: string; file: string; line: number; signature?: string }) =>
                        `  ${r.name} (${r.kind}) in ${r.file}:${r.line}${r.signature ? ` — ${r.signature}` : ""}`
                    ).join("\n")
                    : `No symbols found matching "${data.query}"`;
                break;
            case "check_imports": {
                const parts: string[] = [`File: ${data.file}`];
                if (data.exports?.length) parts.push(`Exports: ${data.exports.map((e: { name: string }) => e.name).join(", ")}`);
                if (data.imports?.length) parts.push(`Imports from: ${data.imports.map((i: { to: string }) => i.to).join(", ")}`);
                if (data.dependents?.length) parts.push(`Depended on by: ${data.dependents.join(", ")}`);
                output = parts.join("\n");
                break;
            }
            case "analyze_architecture":
                output = data.architecture || JSON.stringify(data, null, 2);
                break;
            default:
                output = JSON.stringify(data, null, 2);
        }

        return { success: true, output };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Tool execution failed";
        return { success: false, output: "", error: msg };
    }
}

/* ═══════════════════════════════════════════
   PARSE TOOL CALLS FROM LLM OUTPUT
   ═══════════════════════════════════════════ */

function parseToolCalls(text: string): { textParts: string[]; toolCalls: ToolCall[] } {
    // Match both ```tool and ```json blocks (LLMs sometimes use json instead)
    const toolRegex = /```(?:tool|json)\s*\n([\s\S]*?)```/g;
    const toolCalls: ToolCall[] = [];
    const textParts: string[] = [];

    let lastIndex = 0;
    let match;

    while ((match = toolRegex.exec(text)) !== null) {
        // Text before this tool call
        if (match.index > lastIndex) {
            textParts.push(text.slice(lastIndex, match.index).trim());
        }
        lastIndex = match.index + match[0].length;

        try {
            const parsed = JSON.parse(match[1].trim());
            if (parsed.name && parsed.args) {
                toolCalls.push(parsed);
            }
        } catch {
            // Try to extract JSON from the block even if there's extra text
            try {
                const jsonMatch = match[1].match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.name && parsed.args) {
                        toolCalls.push(parsed);
                    }
                }
            } catch {
                textParts.push(`⚠️ Failed to parse tool call: ${match[1].trim().slice(0, 200)}`);
            }
        }
    }

    // Text after last tool call
    if (lastIndex < text.length) {
        const remaining = text.slice(lastIndex).trim();
        if (remaining) textParts.push(remaining);
    }

    return { textParts, toolCalls };
}

/* ─── Completion Guardrail ─── */

function validateTaskCompletion(
    sessionSteps: AgentStep[],
    intelligence?: PreFlightIntelligence,
): { valid: boolean; reason?: string } {
    const filesCreated = sessionSteps.filter(s => s.type === "tool_call" && s.toolName === "create_file").length;
    const filesEdited = sessionSteps.filter(s => s.type === "tool_call" && s.toolName === "edit_file").length;
    const researchCalls = sessionSteps.filter(s => s.type === "tool_call" && s.toolName === "deep_research").length;
    const confidence = intelligence?.assessment.overallConfidence ?? 1;
    const gaps = intelligence?.assessment.criticalGaps ?? [];
    const totalWork = filesCreated + filesEdited;

    // Rule 1: If low confidence + critical gaps + no research → reject
    if (confidence < 0.5 && gaps.length > 0 && researchCalls === 0) {
        return {
            valid: false,
            reason: `You have ${gaps.length} critical knowledge gaps and only ${Math.round(confidence * 100)}% confidence, ` +
                `but performed 0 research calls. You MUST use deep_research to fill these gaps before completing: ${gaps.slice(0, 3).join(', ')}`,
        };
    }

    // Rule 2: If multiple tool calls happened but 0 files created/edited → likely just described work
    if (totalWork === 0 && sessionSteps.filter(s => s.type === "tool_call").length > 2) {
        return {
            valid: false,
            reason: `No files were created or edited. You described what to build but didn't actually build it. ` +
                `Create the actual implementation files before calling task_complete.`,
        };
    }

    return { valid: true };
}

/* ═══════════════════════════════════════════
   AGENT RUNNER — REACT LOOP
   ═══════════════════════════════════════════ */

export async function runAgent(
    userPrompt: string,
    conversationHistory: ChatMessage[],
    workspace: string,
    onStep: (step: AgentStep) => void,
    signal?: AbortSignal,
): Promise<void> {
    const MAX_ITERATIONS = 30;
    const PRIMARY_AGENT_ID = 'primary-0';
    const sessionSteps: AgentStep[] = []; // Track all steps for completion validation

    // Wrap onStep to accumulate steps
    const emitStep = (step: AgentStep) => {
        sessionSteps.push(step);
        onStep(step);
    };

    // ── Initialize Agent Pool ──
    pool.rebuild();
    ledger.clear();
    const multiAgent = pool.isMultiAgentAvailable();
    const researchCapacity = getResearchCapacity(pool);

    // Log agent start
    ledger.log({
        agentId: PRIMARY_AGENT_ID,
        type: 'agent_assigned',
        topic: userPrompt.slice(0, 100),
        payload: {
            multiAgent,
            researchMode: researchCapacity.mode,
            availableSlots: pool.getSlots().length,
        },
    });

    if (multiAgent) {
        emitStep({
            id: `orchestration-${Date.now()}`,
            type: "thinking",
            content: `🤝 Multi-agent mode: ${pool.getSlots().length} agent slots active | Research: ${researchCapacity.mode} | Cross-validation: enabled`,
            timestamp: Date.now(),
        });
    }

    // ── Pre-flight Deep Intelligence ──
    // Use the LLM itself to decompose the app, research capabilities, and self-assess
    let intelligence: PreFlightIntelligence | undefined;
    let workerContext = ''; // Extra context from parallel workers
    try {
        intelligence = await runPreFlightIntelligence(
            userPrompt,
            callBestProvider,
            searchTavily,
            (status: string) => {
                emitStep({
                    id: `intel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: "thinking",
                    content: status,
                    timestamp: Date.now(),
                });
            },
        );

        // Show the blueprint to the user
        emitStep({
            id: `blueprint-${Date.now()}`,
            type: "response",
            content: `**App Blueprint:** ${intelligence.blueprint.appDescription}\n` +
                `**Subsystems:** ${intelligence.blueprint.subsystems.join(", ")}\n` +
                `**Complexity:** ${intelligence.blueprint.complexity}\n` +
                `**Confidence:** ${Math.round(intelligence.assessment.overallConfidence * 100)}%\n` +
                (intelligence.assessment.criticalGaps.length > 0
                    ? `**Critical Gaps:** ${intelligence.assessment.criticalGaps.join(", ")}`
                    : "**No critical gaps** — ready to build."),
            timestamp: Date.now(),
        });

        // ── DISPATCH PARALLEL WORKERS ──
        // If we have critical gaps AND extra agent slots → dispatch workers in parallel
        if (intelligence.assessment.criticalGaps.length > 0 && pool.isMultiAgentAvailable()) {
            const dispatchResult = await dispatchPreFlightWorkers(
                intelligence.assessment.criticalGaps,
                intelligence.blueprint,
                intelligence.assessment,
                emitStep,
            );

            if (dispatchResult.workersSucceeded > 0) {
                workerContext = dispatchResult.mergedContext;
                emitStep({
                    id: `dispatch-summary-${Date.now()}`,
                    type: "response",
                    content: `**Multi-Agent Research:** ${dispatchResult.workersSucceeded}/${dispatchResult.workersDispatched} workers completed | ` +
                        `${dispatchResult.totalTokens} tokens | ${dispatchResult.wallClockMs}ms`,
                    timestamp: Date.now(),
                });
            }
        }
    } catch (err) {
        // If intelligence fails, continue without it — the agent still works
        emitStep({
            id: `intel-fallback-${Date.now()}`,
            type: "thinking",
            content: "Deep intelligence unavailable — proceeding with standard skills.",
            timestamp: Date.now(),
        });
    }

    const systemPrompt = buildAgentSystemPrompt(workspace, userPrompt, intelligence);
    const awarenessCtx = buildAwarenessContext(PRIMARY_AGENT_ID, ledger);

    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt + awarenessCtx + workerContext },
        ...conversationHistory,
        { role: "user", content: userPrompt },
    ];

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        if (signal?.aborted) {
            emitStep({
                id: `abort-${Date.now()}`,
                type: "error",
                content: "Agent execution was stopped by user.",
                timestamp: Date.now(),
            });
            return;
        }

        // ─── THINK: Get LLM response (with retry) ───
        emitStep({
            id: `think-${i}-${Date.now()}`,
            type: "thinking",
            content: `Iteration ${i + 1}: reasoning...`,
            timestamp: Date.now(),
        });

        let result: ChatResult | null = null;
        let lastError = "";
        for (let retry = 0; retry < 3; retry++) {
            const attempt = await callBestProvider(messages, { maxTokens: 4096, temperature: 0.3 });
            if (!attempt.error) {
                result = attempt;
                break;
            }
            lastError = attempt.error;
            emitStep({
                id: `retry-${Date.now()}-${retry}`,
                type: "thinking",
                content: `⚠️ Provider error: ${attempt.error} — retrying (${retry + 1}/3)...`,
                timestamp: Date.now(),
            });
            // Brief pause before retry
            await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
        }

        if (!result) {
            emitStep({
                id: `err-${Date.now()}`,
                type: "error",
                content: `All providers failed after 3 retries. Last error: ${lastError}. Configure a working provider in Settings (Groq and OpenRouter have free tiers).`,
                timestamp: Date.now(),
            });
            return;
        }

        // ─── PARSE: Extract tool calls and text ───
        const { textParts, toolCalls } = parseToolCalls(result.content);

        // Emit text parts as response
        for (const text of textParts) {
            if (text) {
                emitStep({
                    id: `resp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    type: "response",
                    content: text,
                    timestamp: Date.now(),
                });
            }
        }

        // If no tool calls, the agent is done talking (no action needed)
        if (toolCalls.length === 0) {
            return;
        }

        // Add assistant message to conversation
        messages.push({ role: "assistant", content: result.content });

        // ─── ACT: Execute tool calls ───
        const toolOutputs: string[] = [];

        for (const call of toolCalls) {
            // Check for task_complete
            if (call.name === "task_complete") {
                // ─── COMPLETION GUARDRAIL: Verify actual work was done ───
                const completionCheck = validateTaskCompletion(sessionSteps, intelligence);
                if (!completionCheck.valid) {
                    // Reject the completion — feed the reason back to the agent
                    emitStep({
                        id: `rejected-${Date.now()}`,
                        type: "error",
                        content: `COMPLETION REJECTED: ${completionCheck.reason}`,
                        timestamp: Date.now(),
                    });
                    // Push rejection into conversation so agent corrects itself
                    toolOutputs.push(`[Tool: task_complete]\nREJECTED: ${completionCheck.reason}\nYou must address this before calling task_complete again.`);
                    messages.push({ role: "assistant", content: result.content });
                    messages.push({ role: "user", content: `Your task_complete call was REJECTED. Reason: ${completionCheck.reason}\n\nDo the actual work, then try again.` });
                    continue; // Skip to next tool call or next iteration
                }

                emitStep({
                    id: `complete-${Date.now()}`,
                    type: "response",
                    content: `**Task Complete**\n\n${call.args.summary}`,
                    timestamp: Date.now(),
                });
                return;
            }

            // Emit tool call step
            emitStep({
                id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: "tool_call",
                content: `Calling \`${call.name}\``,
                toolName: call.name,
                toolArgs: call.args,
                timestamp: Date.now(),
            });

            // Execute
            const toolResult = await executeTool(call, workspace);

            // Log tool call + result to ledger
            ledger.log({
                agentId: PRIMARY_AGENT_ID,
                type: 'tool_called',
                topic: call.name,
                payload: { args: call.args },
            });
            ledger.log({
                agentId: PRIMARY_AGENT_ID,
                type: 'tool_result',
                topic: call.name,
                payload: { success: toolResult.success, outputLength: toolResult.output.length },
            });

            // Cross-validation: verify file creation with a different model
            if (toolResult.success && shouldValidate(call.name, toolResult.output, pool)) {
                const validation = await crossValidate(
                    {
                        type: call.name === 'create_file' ? 'code' : call.name === 'analyze_architecture' ? 'architecture' : 'code',
                        content: call.name === 'create_file' ? (call.args.content as string) : toolResult.output,
                        context: call.name === 'create_file' ? `File: ${call.args.path}` : call.name,
                        primaryModel: getSelectedModel(result!.provider),
                        primaryProvider: result!.provider,
                    },
                    pool,
                    ledger,
                );

                if (!validation.skipped) {
                    emitStep({
                        id: `validation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        type: validation.valid ? "thinking" : "tool_result",
                        content: validation.valid
                            ? `✅ Cross-validated by ${validation.validatorModel} (${Math.round(validation.confidence * 100)}% confidence)`
                            : `⚠️ Validation issues (${validation.validatorModel}): ${validation.issues.map(i => i.description).join('; ')}`,
                        timestamp: Date.now(),
                    });

                    // If validation found errors, append to tool output so the agent fixes them
                    if (!validation.valid && validation.issues.length > 0) {
                        toolResult.output += `\n\n⚠️ CROSS-VALIDATION ISSUES (from ${validation.validatorModel}):\n` +
                            validation.issues.map(i => `- [${i.severity}] ${i.description}`).join('\n') +
                            '\nPlease address these issues.';
                    }
                }
            }

            // Emit tool result
            emitStep({
                id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: "tool_result",
                content: toolResult.success ? toolResult.output : `❌ ${toolResult.error}`,
                toolName: call.name,
                toolResult,
                timestamp: Date.now(),
            });

            toolOutputs.push(
                `[Tool: ${call.name}]\n${toolResult.success ? toolResult.output : `ERROR: ${toolResult.error}`}`
            );
        }

        // ─── OBSERVE: Feed results back to the LLM ───
        // Check if any run_command failed (build verification)
        const hasCommandFailure = toolCalls.some((call, idx) => {
            if (call.name !== 'run_command') return false;
            const output = toolOutputs[idx] || '';
            return output.includes('Exit code: 1') || output.includes('ERROR:');
        });

        let feedbackSuffix = '';
        if (hasCommandFailure) {
            // Inline build failure analysis (client-safe)
            const failedOutput = toolOutputs.find(o => o.includes('Exit code: 1') || o.includes('ERROR:')) || '';
            const lowerOutput = failedOutput.toLowerCase();

            let category = 'unknown';
            let fixHint = 'Analyze the error output carefully.';

            if (lowerOutput.includes('ts2304') || lowerOutput.includes('ts2305') || lowerOutput.includes('cannot find name')) {
                category = 'missing_import';
                fixHint = 'Add missing import statements. Use find_symbol to verify the correct export.';
            } else if (lowerOutput.includes('ts') && lowerOutput.includes('error')) {
                category = 'type_error';
                fixHint = 'Fix type mismatches. Use find_symbol to verify correct types.';
            } else if (lowerOutput.includes('module not found') || lowerOutput.includes('cannot find module')) {
                category = 'dependency';
                fixHint = 'Run npm install for missing packages or check import paths.';
            } else if (lowerOutput.includes('syntax') || lowerOutput.includes('unexpected token')) {
                category = 'syntax';
                fixHint = 'Fix syntax issues — check brackets, semicolons, expressions.';
            }

            feedbackSuffix = `\n\n⚠️ BUILD FAILURE DETECTED — ${category}\n`;
            feedbackSuffix += `Fix Strategy: ${fixHint}\n`;
            feedbackSuffix += `\nAnalyze the error, apply the fix strategy, and rebuild. Do NOT give up.`;
        } else {
            // Check if the agent expressed uncertainty — trigger mid-task learning hint
            const lastAssistant = result.content.toLowerCase();
            const isUncertain = lastAssistant.includes("i'm not sure") ||
                lastAssistant.includes("i don't know") ||
                lastAssistant.includes("i'm unsure") ||
                lastAssistant.includes("need to research") ||
                lastAssistant.includes("not confident");

            if (isUncertain) {
                feedbackSuffix = '\n\n🔍 You expressed uncertainty. Use `deep_research` with a SPECIFIC question about what you\'re unsure about before proceeding. Don\'t guess.';
            } else {
                feedbackSuffix = '\n\nContinue with the next step. If all steps are complete, call task_complete.';
            }
        }

        messages.push({
            role: "user",
            content: `Tool results:\n\n${toolOutputs.join("\n\n---\n\n")}${feedbackSuffix}`,
        });
    }

    emitStep({
        id: `limit-${Date.now()}`,
        type: "error",
        content: `Reached maximum iterations (${MAX_ITERATIONS}). The agent stopped to prevent infinite loops.`,
        timestamp: Date.now(),
    });
}

/* ═══════════════════════════════════════════
   PROVIDER ROUTING
   ═══════════════════════════════════════════ */

async function callBestProvider(
    messages: ChatMessage[],
    options: { maxTokens: number; temperature: number },
): Promise<ChatResult> {
    // Priority: Ollama (local/free) → Groq (free/fast) → OpenRouter (free models) → Gemini (free/1M context) → OpenAI → Anthropic
    const order: ProviderName[] = ["ollama", "groq", "openrouter", "gemini", "openai", "anthropic"];
    const errors: string[] = [];

    for (const provider of order) {
        const config = getProviderConfig(provider);
        // Ollama doesn't need an API key — just needs to be running
        if (provider !== "ollama" && !config.apiKey) continue;

        const model = getSelectedModel(provider);
        const chatOptions = { model, ...options };

        try {
            let result: ChatResult;
            switch (provider) {
                case "ollama":
                    result = await chatOllama(messages, chatOptions);
                    break;
                case "groq":
                    result = await chatGroq(messages, chatOptions);
                    break;
                case "openrouter":
                    result = await chatOpenRouter(messages, chatOptions);
                    break;
                case "gemini":
                    result = await chatGemini(messages, chatOptions);
                    break;
                case "openai":
                    result = await chatOpenAI(messages, chatOptions);
                    break;
                case "anthropic":
                    result = await chatAnthropic(messages, chatOptions);
                    break;
                default:
                    continue;
            }

            // CRITICAL FIX: Check for returned errors (not just thrown exceptions)
            // Some providers return { error: "..." } instead of throwing
            if (result.error) {
                errors.push(`${provider}: ${result.error}`);
                console.warn(`Provider ${provider} returned error: ${result.error}, trying next...`);
                continue;  // Fall through to next provider
            }

            return result;
        } catch (err) {
            // If this provider throws, try the next one
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${provider}: ${msg}`);
            console.warn(`Provider ${provider} threw error, trying next...`, err);
            continue;
        }
    }

    return {
        content: "",
        model: "",
        provider: "ollama",
        error: `All providers failed. ${errors.join(" | ")}. Add API keys for Groq/OpenRouter/OpenAI/Anthropic in Settings.`,
    };
}
