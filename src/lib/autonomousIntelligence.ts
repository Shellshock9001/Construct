/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — True Autonomous Intelligence
   
   LLM-powered deep awareness. The agent uses its own AI brain to:
   1. Decompose ANY app into subsystems, capabilities, and libraries
   2. Strategically research how real apps are built
   3. Honestly assess what it knows vs. what it'll get wrong
   4. Continuously discover and fill knowledge gaps mid-task
   
   No keyword matching. No fake confidence scores. The LLM reasons.
   ═══════════════════════════════════════════════════════════════════ */

import { type SkillProfile, SKILL_PROFILES, identifySkills } from "./skillsKnowledge";
import { researchDocs, formatDocResult } from "./researchDocs";
import {
    type ChatMessage,
    type ChatResult,
    searchTavily,
} from "./providers";
import { queryRegistry, formatAPIsForContext } from "./apiRegistry";

/* ─── Types ─── */

/** Per-subsystem architecture spec — files, interfaces, data models, critical logic */
export interface SubsystemSpec {
    /** Subsystem identifier (e.g., "battle-engine") */
    name: string;
    /** What this subsystem does */
    purpose: string;
    /** Concrete file paths relative to project root */
    files: string[];
    /** TypeScript interfaces this subsystem defines or consumes */
    interfaces: string[];
    /** Data models / schemas */
    dataModels: string[];
    /** External APIs this subsystem depends on */
    externalAPIs?: string[];
    /** The hardest implementation logic — what the LLM must get right */
    criticalLogic: string;
    /** Other subsystems this depends on */
    dependsOn: string[];
}

/** Full architectural decomposition of what an app requires */
export interface AppBlueprint {
    /** What the user is asking to build, in plain language */
    appDescription: string;
    /** Subsystem names for backward compatibility and quick reference */
    subsystems: string[];
    /** Detailed per-subsystem architecture specs (populated for complex/expert apps) */
    subsystemSpecs: SubsystemSpec[];
    /** Specific technical capabilities needed */
    capabilities: string[];
    /** Libraries, APIs, and tools that solve these problems */
    libraries: string[];
    /** Recommended architecture pattern */
    architecture: string;
    /** Domain knowledge the builder needs but probably doesn't have */
    domainKnowledge: string[];
    /** Complexity tier */
    complexity: "simple" | "moderate" | "complex" | "expert";
}

/** Structured research findings from Tavily */
export interface ResearchReport {
    /** Per-capability research findings */
    findings: ResearchFinding[];
    /** Overall architecture recommendations from real-world examples */
    architectureInsights: string;
    /** Library comparison and recommendations */
    libraryRecommendations: string;
    /** Raw research sources for attribution */
    sources: Array<{ title: string; url: string; snippet: string }>;
}

export interface ResearchFinding {
    /** The capability or subsystem this research is about */
    topic: string;
    /** What was learned */
    knowledge: string;
    /** Specific code patterns or approaches discovered */
    patterns: string[];
    /** Pitfalls to avoid */
    pitfalls: string[];
}

/** Honest per-subsystem confidence assessment */
export interface IntelligenceAssessment {
    /** Overall confidence 0.0-1.0 (LLM-evaluated, not calculated) */
    overallConfidence: number;
    /** Per-subsystem assessment */
    subsystemAssessments: SubsystemAssessment[];
    /** What the agent should research MORE before building */
    criticalGaps: string[];
    /** Learning priority queue — what to research first */
    learningPriority: string[];
    /** Human-readable honest assessment */
    narrative: string;
}

export interface SubsystemAssessment {
    name: string;
    confidence: "high" | "medium" | "low" | "none";
    reasoning: string;
    /** Specific things that need more research for this subsystem */
    gapsInKnowledge: string[];
}

/** Complete pre-flight intelligence package */
export interface PreFlightIntelligence {
    blueprint: AppBlueprint;
    research: ResearchReport;
    assessment: IntelligenceAssessment;
    /** Formatted context string ready for injection into system prompt */
    contextForPrompt: string;
}

/* ═══════════════════════════════════════════
   1. DEEP APP DECOMPOSITION — LLM analyzes what building this REALLY requires
   ═══════════════════════════════════════════ */

const DECOMPOSITION_PROMPT = `You are a senior software architect. Given a user's request to build something, decompose it into a detailed technical blueprint.

Think deeply about what this app ACTUALLY requires to build properly. Don't just list obvious things — think about:
- What subsystems need to exist (not just "frontend" and "backend" — specific engines/modules)
- What technical capabilities each subsystem needs (specific algorithms, protocols, data handling)
- What libraries/APIs exist to solve these problems (be specific — actual npm packages, browser APIs, etc.)
- What architecture pattern makes this work at scale
- What domain knowledge is needed that most developers DON'T have
- What legal, IP, or licensing concerns exist (e.g., using copyrighted characters/brands)

COHERENCE RULES (CRITICAL):
- Do NOT mix competing technologies that serve the same purpose (e.g., Unity + Phaser, React + Angular, Express + Fastify)
- Each recommended library must solve a SPECIFIC capability from your list — no generic padding
- If you recommend a game engine, ALL rendering/animation goes through that engine — do not add a second rendering library
- If the request involves copyrighted IP (Pokémon, Marvel, Disney, etc.), note this as a legal risk in domainKnowledge
- If the request requires server infrastructure (MMORPG, real-time multiplayer), specify:
  - Server topology (shards, instances, rooms, lobbies)
  - Scaling strategy (horizontal/vertical, how many players per server)
  - State sync mechanism (authoritative server, client prediction, reconciliation)

Respond in EXACTLY this JSON format (no markdown, no explanation, just JSON):
{
    "appDescription": "one-line description of what's being built",
    "subsystems": ["specific-subsystem-1", "specific-subsystem-2", ...],
    "capabilities": ["specific-capability-1", "specific-capability-2", ...],
    "libraries": ["library-or-api-1 — brief description", "library-or-api-2 — brief description", ...],
    "architecture": "recommended architecture pattern in 1-2 sentences",
    "domainKnowledge": ["specific-domain-knowledge-1", "specific-domain-knowledge-2", ...],
    "complexity": "simple|moderate|complex|expert"
}

Examples of GOOD decomposition:
- "Build CapCut Pro" → subsystems: ["timeline-engine", "video-decoder", "effect-compositor", "audio-sync-engine", "export-pipeline", "asset-manager", "ui-layer"], capabilities: ["frame-by-frame seeking", "non-linear editing", "real-time preview at 30fps", "filter/effect compositing", "audio waveform visualization", "multi-format export (MP4/WebM/GIF)"], etc.

Examples of BAD decomposition (DO NOT DO THIS):
- subsystems: ["frontend", "backend", "database"] — too generic
- capabilities: ["handle video", "play audio"] — too vague
- libraries: ["React", "Node.js"] — too obvious, not specific enough
- mixing Unity + Phaser — both are rendering engines, pick ONE
- saying "Use MySQL" without specifying what data model or query patterns`;

/** Prompt used for the second pass — expanding each subsystem into concrete specs */
const SUBSYSTEM_EXPANSION_PROMPT = `You are a senior software architect. You already produced a high-level blueprint. Now expand EVERY subsystem into a concrete specification.

For EACH subsystem, you MUST specify:
- files: concrete file paths relative to project root (e.g., "server/src/battle/damage.ts")
- interfaces: TypeScript interfaces this subsystem defines (e.g., "BattleState", "DamageCalcInput")
- dataModels: data structures / database schemas (e.g., "Move", "TypeChart", "PlayerPokemon")
- externalAPIs: external services this subsystem calls (e.g., "PokéAPI for move data")
- criticalLogic: the hardest implementation detail — what you MUST get right (e.g., "STAB multiplier = 1.5 when move type matches attacker type; type chart is a 18x18 matrix of multipliers")
- dependsOn: which other subsystems this needs

Do NOT be generic. "Handle battle logic" is WRONG. "Damage = ((2*Level/5+2) * Power * A/D) / 50 + 2, multiplied by STAB (1.5), type effectiveness (0/0.25/0.5/1/2/4), random factor (0.85-1.0)" is RIGHT.

Respond in EXACTLY this JSON format (array of subsystem specs):
[
    {
        "name": "subsystem-name",
        "purpose": "what this subsystem does",
        "files": ["path/to/file1.ts", "path/to/file2.ts"],
        "interfaces": ["Interface1", "Interface2"],
        "dataModels": ["Model1", "Model2"],
        "externalAPIs": ["API1"],
        "criticalLogic": "The exact algorithm, formula, or protocol this must implement",
        "dependsOn": ["other-subsystem"]
    }
]

IMPORTANT: Every subsystem from the blueprint MUST appear. Do NOT skip any. Do NOT add generic placeholders.`;

/**
 * Use the LLM to deeply decompose what building this app actually requires.
 * This is the fundamental intelligence operation — the LLM reasons about
 * architecture, not keyword matching.
 */
export async function deepDecomposeApp(
    userPrompt: string,
    callLLM: (messages: ChatMessage[], options: { maxTokens: number; temperature: number }) => Promise<ChatResult>,
): Promise<AppBlueprint> {
    let blueprint = await _callDecomposition(userPrompt, callLLM, DECOMPOSITION_PROMPT);

    // Validate depth — reject shallow blueprints and re-prompt
    const validation = validateBlueprintDepth(blueprint);
    if (!validation.valid) {
        const rePrompt = DECOMPOSITION_PROMPT + `\n\nYour previous attempt was rejected for these reasons:\n${validation.issues.map(i => `- ${i}`).join('\n')}\n\nFix ALL of these issues. Be MORE SPECIFIC and DEEPER in your analysis. Do NOT repeat the same generic structure.`;
        blueprint = await _callDecomposition(userPrompt, callLLM, rePrompt);
    }

    // Check technology coherence
    const coherence = checkTechCoherence(blueprint);
    if (!coherence.valid) {
        blueprint.domainKnowledge = [
            ...blueprint.domainKnowledge,
            ...coherence.issues.map(i => `TECH CONFLICT: ${i}`),
        ];
    }

    // Pass 2: Expand subsystems into concrete specs (complex/expert only)
    if (blueprint.complexity === 'complex' || blueprint.complexity === 'expert') {
        blueprint.subsystemSpecs = await _expandSubsystems(blueprint, callLLM);
    }

    return blueprint;
}

/** Second pass: expand each subsystem into files, interfaces, data models, critical logic */
async function _expandSubsystems(
    blueprint: AppBlueprint,
    callLLM: (messages: ChatMessage[], options: { maxTokens: number; temperature: number }) => Promise<ChatResult>,
): Promise<SubsystemSpec[]> {
    const contextSummary = `App: ${blueprint.appDescription}\nArchitecture: ${blueprint.architecture}\nSubsystems: ${blueprint.subsystems.join(', ')}\nCapabilities: ${blueprint.capabilities.join(', ')}\nLibraries: ${blueprint.libraries.join(', ')}`;

    const messages: ChatMessage[] = [
        { role: 'system', content: SUBSYSTEM_EXPANSION_PROMPT },
        { role: 'user', content: `Expand these subsystems into concrete specs:\n\n${contextSummary}` },
    ];

    try {
        const result = await callLLM(messages, { maxTokens: 6144, temperature: 0.2 });
        if (result.error || !result.content) return _fallbackSpecs(blueprint);

        const jsonMatch = result.content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return _fallbackSpecs(blueprint);

        const parsed = JSON.parse(jsonMatch[0]) as SubsystemSpec[];
        if (!Array.isArray(parsed) || parsed.length === 0) return _fallbackSpecs(blueprint);

        // Ensure every declared subsystem has a spec
        const specNames = new Set(parsed.map(s => s.name));
        for (const sub of blueprint.subsystems) {
            if (!specNames.has(sub)) {
                parsed.push({
                    name: sub,
                    purpose: `Implementation of ${sub}`,
                    files: [`src/${sub.replace(/-/g, '/')}/index.ts`],
                    interfaces: [],
                    dataModels: [],
                    criticalLogic: 'Needs detailed specification',
                    dependsOn: [],
                });
            }
        }

        return parsed;
    } catch (error) {
        console.error('Subsystem expansion failed:', error);
        return _fallbackSpecs(blueprint);
    }
}

function _fallbackSpecs(bp: AppBlueprint): SubsystemSpec[] {
    return bp.subsystems.map(name => ({
        name,
        purpose: `Implementation of ${name}`,
        files: [`src/${name.replace(/-/g, '/')}/index.ts`],
        interfaces: [],
        dataModels: [],
        criticalLogic: 'Needs detailed specification',
        dependsOn: [],
    }));
}

async function _callDecomposition(
    userPrompt: string,
    callLLM: (messages: ChatMessage[], options: { maxTokens: number; temperature: number }) => Promise<ChatResult>,
    systemPrompt: string,
): Promise<AppBlueprint> {
    const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Decompose this request into a detailed technical blueprint:\n\n"${userPrompt}"` },
    ];

    try {
        // Scale tokens by expected complexity — simple apps need less, expert apps need much more
        const result = await callLLM(messages, { maxTokens: 4096, temperature: 0.3 });
        if (result.error || !result.content) return getFallbackBlueprint(userPrompt);
        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return getFallbackBlueprint(userPrompt);
        const parsed = JSON.parse(jsonMatch[0]) as Partial<AppBlueprint>;
        if (!parsed.subsystems?.length || !parsed.capabilities?.length) return getFallbackBlueprint(userPrompt);
        // Ensure subsystemSpecs exists (may be empty — pass 2 fills it for complex/expert)
        return { ...getFallbackBlueprint(userPrompt), ...parsed, subsystemSpecs: parsed.subsystemSpecs || [] };
    } catch (error) {
        console.error("Deep decomposition failed:", error);
        return getFallbackBlueprint(userPrompt);
    }
}

/* ─── Blueprint Depth Validation ─── */

function validateBlueprintDepth(bp: AppBlueprint): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Generic subsystems are a red flag
    const generic = ["frontend", "backend", "database", "ui", "server", "client", "api"];
    const genericCount = bp.subsystems.filter(s => generic.includes(s.toLowerCase().replace(/[-_]/g, ''))).length;
    if (genericCount > Math.max(1, bp.subsystems.length * 0.4)) {
        issues.push(`${genericCount}/${bp.subsystems.length} subsystems are generic (frontend/backend/database). Name specific engines and modules.`);
    }

    // Capabilities must be concrete (at least 3 words)
    const vague = bp.capabilities.filter(c => c.split(/\s+/).length < 3);
    if (vague.length > bp.capabilities.length * 0.3) {
        issues.push(`${vague.length} capabilities are too vague ("${vague[0]}"). Each must describe a specific technical action.`);
    }

    // Complex/expert apps require domain knowledge
    if ((bp.complexity === "complex" || bp.complexity === "expert") && bp.domainKnowledge.length < 2) {
        issues.push(`Complexity is "${bp.complexity}" but only ${bp.domainKnowledge.length} domain knowledge items. Complex projects require deep domain awareness.`);
    }

    // Libraries should include specific packages, not just frameworks
    const frameworksOnly = ["react", "node.js", "express", "next.js", "vue", "angular", "svelte"];
    const onlyFrameworks = bp.libraries.every(l => frameworksOnly.includes(l.split(/\s/)[0].toLowerCase()));
    if (onlyFrameworks && bp.libraries.length > 0 && bp.capabilities.length > 3) {
        issues.push("Libraries list only contains obvious frameworks. Add specific packages that solve your listed capabilities.");
    }

    // Minimum subsystem count for non-simple apps
    if (bp.complexity !== "simple" && bp.subsystems.length < 4) {
        issues.push(`Only ${bp.subsystems.length} subsystems for a "${bp.complexity}" app. Break it down further.`);
    }

    return { valid: issues.length === 0, issues };
}

/* ─── Technology Coherence Check ─── */

const COMPETING_TECH: [string[], string][] = [
    [["unity", "phaser", "godot", "unreal", "pixi"], "game engines/renderers — pick ONE"],
    [["react", "angular", "vue", "svelte"], "frontend frameworks — pick ONE"],
    [["express", "fastify", "koa", "hapi"], "HTTP server frameworks — pick ONE"],
    [["mysql", "postgresql", "mariadb"], "SQL databases — pick ONE unless migrating"],
    [["mongodb", "couchdb", "dynamodb"], "NoSQL document databases — pick ONE"],
    [["socket.io", "ws", "sockjs"], "WebSocket libraries — pick ONE"],
    [["tailwind", "bootstrap", "bulma", "material-ui"], "CSS frameworks — pick ONE"],
];

function checkTechCoherence(bp: AppBlueprint): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    const allText = [...bp.libraries, ...bp.subsystems, bp.architecture].join(' ').toLowerCase();

    for (const [group, label] of COMPETING_TECH) {
        const found = group.filter(t => allText.includes(t));
        if (found.length > 1) {
            issues.push(`Conflicting ${label}: ${found.join(" + ")}. These serve the same purpose — pick one.`);
        }
    }

    return { valid: issues.length === 0, issues };
}

/** Fallback when LLM decomposition fails — still better than nothing */
function getFallbackBlueprint(prompt: string): AppBlueprint {
    return {
        appDescription: prompt.slice(0, 200),
        subsystems: ["core-logic", "ui-layer", "data-layer"],
        subsystemSpecs: [],
        capabilities: ["user input handling", "data persistence", "responsive UI"],
        libraries: ["Framework TBD — research needed"],
        architecture: "Standard client-server or SPA — research to determine best fit",
        domainKnowledge: ["Research needed for domain-specific requirements"],
        complexity: "moderate",
    };
}

/* ═══════════════════════════════════════════
   2. STRATEGIC RESEARCH — How are real apps like this built?
   ═══════════════════════════════════════════ */

/**
 * Research each unknown capability/subsystem via Tavily.
 * Generates SPECIFIC queries, not "best practices" nonsense.
 */
export async function strategicResearch(
    blueprint: AppBlueprint,
    tavilySearch: typeof searchTavily,
): Promise<ResearchReport> {
    const findings: ResearchFinding[] = [];
    const allSources: Array<{ title: string; url: string; snippet: string }> = [];

    // Generate targeted research queries from the blueprint
    const researchQueries = generateResearchQueries(blueprint);

    // Execute research in parallel (max 5 concurrent to avoid rate limits)
    const BATCH_SIZE = 5;
    for (let i = 0; i < researchQueries.length; i += BATCH_SIZE) {
        const batch = researchQueries.slice(i, i + BATCH_SIZE);

        const results = await Promise.allSettled(
            batch.map(async (q) => {
                const result = await tavilySearch(q.query, {
                    depth: "advanced",
                    maxResults: 3,
                });
                return { topic: q.topic, result };
            }),
        );

        for (const res of results) {
            if (res.status !== "fulfilled" || !res.value.result) continue;

            const { topic, result } = res.value;

            // Extract knowledge from search results
            const snippets = result.sources.map(s => s.snippet).filter(Boolean);
            const knowledge = snippets.join(" ").slice(0, 1500);

            // Extract patterns (lines that look like code or specific advice)
            const patterns = snippets
                .flatMap(s => s.split(/[.!]/).filter(part =>
                    part.includes("use ") || part.includes("import ") ||
                    part.includes("recommend") || part.includes("pattern") ||
                    part.includes("API") || part.includes("example")
                ))
                .map(p => p.trim())
                .filter(p => p.length > 20 && p.length < 300)
                .slice(0, 5);

            // Extract pitfalls
            const pitfalls = snippets
                .flatMap(s => s.split(/[.!]/).filter(part =>
                    part.includes("avoid") || part.includes("don't") ||
                    part.includes("mistake") || part.includes("pitfall") ||
                    part.includes("instead") || part.includes("deprecated") ||
                    part.includes("warning") || part.includes("careful")
                ))
                .map(p => p.trim())
                .filter(p => p.length > 15 && p.length < 300)
                .slice(0, 3);

            findings.push({
                topic,
                knowledge: knowledge || "No detailed findings — may need manual research.",
                patterns,
                pitfalls,
            });

            for (const s of result.sources) {
                allSources.push({ title: s.title, url: s.url, snippet: s.snippet });
            }
        }
    }

    // Research the overall architecture by looking at real-world examples
    let architectureInsights = "";
    let libraryRecommendations = "";

    try {
        const archResult = await tavilySearch(
            `how to build ${blueprint.appDescription} architecture open source example`,
            { depth: "advanced", maxResults: 3 },
        );
        if (archResult) {
            architectureInsights = archResult.answer ||
                archResult.sources.map(s => s.snippet).join(" ").slice(0, 1000);
            for (const s of archResult.sources) {
                allSources.push({ title: s.title, url: s.url, snippet: s.snippet });
            }
        }
    } catch { /* continue without arch insights */ }

    try {
        const libResult = await tavilySearch(
            `${blueprint.libraries.slice(0, 3).join(" vs ")} comparison ${new Date().getFullYear()}`,
            { depth: "basic", maxResults: 3 },
        );
        if (libResult) {
            libraryRecommendations = libResult.answer ||
                libResult.sources.map(s => s.snippet).join(" ").slice(0, 800);
        }
    } catch { /* continue without lib comparison */ }

    return {
        findings,
        architectureInsights: architectureInsights || "No architecture insights found — will use best judgment.",
        libraryRecommendations: libraryRecommendations || "No library comparisons found — will research as needed.",
        sources: allSources,
    };
}

/** Generate specific research queries from the blueprint — NOT generic "best practices" */
function generateResearchQueries(blueprint: AppBlueprint): Array<{ topic: string; query: string }> {
    const queries: Array<{ topic: string; query: string }> = [];

    // Research specific capabilities (the hard parts)
    for (const capability of blueprint.capabilities.slice(0, 8)) {
        queries.push({
            topic: capability,
            query: `how to implement ${capability} in JavaScript TypeScript ${new Date().getFullYear()} tutorial`,
        });
    }

    // Research domain knowledge
    for (const domain of blueprint.domainKnowledge.slice(0, 4)) {
        queries.push({
            topic: domain,
            query: `${domain} for developers practical guide`,
        });
    }

    // Research specific libraries
    for (const lib of blueprint.libraries.slice(0, 4)) {
        const libName = lib.split(" — ")[0]; // strip description
        queries.push({
            topic: lib,
            query: `${libName} getting started tutorial npm`,
        });
    }

    return queries;
}

/* ═══════════════════════════════════════════
   3. HONEST SELF-ASSESSMENT — The LLM evaluates itself against the blueprint
   ═══════════════════════════════════════════ */

const ASSESSMENT_PROMPT = `You are an honest AI self-evaluator. Given a technical blueprint and research findings for a project, honestly assess your ability to build each subsystem.

BE BRUTALLY HONEST. If you don't know how to do something, say so. If your knowledge is based on generic patterns and you'd be guessing at the implementation, say "low" or "none" confidence.

High confidence = "I've seen many examples and know the exact APIs/patterns to use"
Medium confidence = "I understand the concept and have some knowledge, but may need to research specifics"
Low confidence = "I have a vague idea but would likely make significant mistakes without more research"
None = "I genuinely don't know how to do this"

Respond in EXACTLY this JSON format:
{
    "overallConfidence": 0.0-1.0,
    "subsystemAssessments": [
        {
            "name": "subsystem-name",
            "confidence": "high|medium|low|none",
            "reasoning": "why this confidence level",
            "gapsInKnowledge": ["specific thing I don't know"]
        }
    ],
    "criticalGaps": ["things that MUST be researched before building"],
    "learningPriority": ["ordered list of what to learn first"],
    "narrative": "2-3 sentence honest self-assessment for the user"
}`;

/**
 * LLM honestly evaluates: "Given what I know and what I've researched,
 * which parts of this can I confidently build vs. which will I get wrong?"
 */
export async function honestSelfAssess(
    blueprint: AppBlueprint,
    research: ResearchReport,
    callLLM: (messages: ChatMessage[], options: { maxTokens: number; temperature: number }) => Promise<ChatResult>,
): Promise<IntelligenceAssessment> {
    const researchSummary = research.findings.length > 0
        ? research.findings.map(f => `${f.topic}: ${f.knowledge.slice(0, 200)}`).join("\n")
        : "No research was conducted.";

    const messages: ChatMessage[] = [
        { role: "system", content: ASSESSMENT_PROMPT },
        {
            role: "user",
            content: `Assess your ability to build this:

## Blueprint
App: ${blueprint.appDescription}
Subsystems: ${blueprint.subsystems.join(", ")}
Capabilities needed: ${blueprint.capabilities.join(", ")}
Libraries: ${blueprint.libraries.join(", ")}
Architecture: ${blueprint.architecture}
Domain knowledge needed: ${blueprint.domainKnowledge.join(", ")}
Complexity: ${blueprint.complexity}

## Research Findings
${researchSummary}

## Architecture Insights
${research.architectureInsights.slice(0, 500)}

Now honestly assess your confidence for each subsystem.`,
        },
    ];

    try {
        const result = await callLLM(messages, { maxTokens: 2048, temperature: 0.2 });

        if (result.error || !result.content) {
            return getFallbackAssessment(blueprint);
        }

        const jsonMatch = result.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return getFallbackAssessment(blueprint);
        }

        const parsed = JSON.parse(jsonMatch[0]) as IntelligenceAssessment;

        // Validate
        if (!parsed.subsystemAssessments?.length || typeof parsed.overallConfidence !== "number") {
            return getFallbackAssessment(blueprint);
        }

        return parsed;
    } catch (error) {
        console.error("Self-assessment failed:", error);
        return getFallbackAssessment(blueprint);
    }
}

function getFallbackAssessment(blueprint: AppBlueprint): IntelligenceAssessment {
    return {
        overallConfidence: 0.4,
        subsystemAssessments: blueprint.subsystems.map(s => ({
            name: s,
            confidence: "medium" as const,
            reasoning: "Assessment unavailable — defaulting to medium confidence.",
            gapsInKnowledge: ["Need to verify approach with research"],
        })),
        criticalGaps: ["Self-assessment failed — proceed with caution and research as you go"],
        learningPriority: blueprint.domainKnowledge,
        narrative: "Self-assessment unavailable. I'll proceed carefully and research each subsystem as I build.",
    };
}

/* ═══════════════════════════════════════════
   4. CONTINUOUS MID-TASK LEARNING — Research specific questions on the fly
   ═══════════════════════════════════════════ */

/**
 * Deep research on a specific question or capability.
 * Called when the agent discovers a gap mid-task.
 * Much more focused than generic "learn_skill" — takes a real question.
 */
export async function deepResearch(
    question: string,
    tavilySearch: typeof searchTavily,
): Promise<string> {
    try {
        // Execute 2 targeted searches: one for how-to, one for examples
        const [howTo, examples] = await Promise.allSettled([
            tavilySearch(
                `${question} implementation guide tutorial`,
                { depth: "advanced", maxResults: 4 },
            ),
            tavilySearch(
                `${question} code example github`,
                { depth: "basic", maxResults: 3 },
            ),
        ]);

        const sections: string[] = [];

        if (howTo.status === "fulfilled" && howTo.value) {
            if (howTo.value.answer) {
                sections.push(`## Answer\n${howTo.value.answer}`);
            }
            const sources = howTo.value.sources
                .map(s => `- **${s.title}**: ${s.snippet}`)
                .join("\n");
            if (sources) sections.push(`## Sources\n${sources}`);
        }

        if (examples.status === "fulfilled" && examples.value) {
            const codeExamples = examples.value.sources
                .filter(s => s.snippet.includes("import ") || s.snippet.includes("function ") ||
                    s.snippet.includes("const ") || s.snippet.includes("class "))
                .map(s => `- [${s.title}](${s.url}): ${s.snippet}`)
                .join("\n");
            if (codeExamples) sections.push(`## Code Examples\n${codeExamples}`);
        }

        if (sections.length === 0) {
            return `No detailed results found for: "${question}". Try rephrasing or breaking it into smaller questions.`;
        }

        return `# Deep Research: ${question}\n\n${sections.join("\n\n")}`;
    } catch (error) {
        return `Research failed for "${question}": ${error instanceof Error ? error.message : "Unknown error"}`;
    }
}

/* ═══════════════════════════════════════════
   5. FULL PRE-FLIGHT PIPELINE — Run all intelligence steps
   ═══════════════════════════════════════════ */

/**
 * Complete pre-flight intelligence pipeline:
 * 1. LLM decomposes the app → AppBlueprint
 * 2. Tavily researches each unknown → ResearchReport
 * 3. LLM honestly assesses confidence → IntelligenceAssessment
 * 4. Format everything for system prompt injection
 */
export async function runPreFlightIntelligence(
    userPrompt: string,
    callLLM: (messages: ChatMessage[], options: { maxTokens: number; temperature: number }) => Promise<ChatResult>,
    tavilySearch: typeof searchTavily,
    onStatus: (msg: string) => void,
): Promise<PreFlightIntelligence> {

    // Step 1: Deep decomposition
    onStatus("🧠 Analyzing what this app ACTUALLY requires...");
    const blueprint = await deepDecomposeApp(userPrompt, callLLM);
    onStatus(`📋 Blueprint: ${blueprint.subsystems.length} subsystems, ${blueprint.capabilities.length} capabilities, complexity: ${blueprint.complexity}`);

    // Step 2: Strategic research (skip for simple apps to save time/API calls)
    let research: ResearchReport;
    if (blueprint.complexity === "simple") {
        research = {
            findings: [],
            architectureInsights: "Simple app — standard patterns apply.",
            libraryRecommendations: "",
            sources: [],
        };
        onStatus("📚 Simple app detected — skipping deep research.");
    } else {
        onStatus(`🔍 Researching ${blueprint.capabilities.length} capabilities and ${blueprint.domainKnowledge.length} domain areas...`);
        research = await strategicResearch(blueprint, tavilySearch);
        onStatus(`📚 Research complete: ${research.findings.length} topics researched, ${research.sources.length} sources found.`);
    }

    // Step 3: Honest self-assessment
    onStatus("🪞 Honestly assessing my capabilities against this blueprint...");
    const assessment = await honestSelfAssess(blueprint, research, callLLM);
    onStatus(`📊 Self-assessment: ${Math.round(assessment.overallConfidence * 100)}% overall confidence. ${assessment.criticalGaps.length} critical gaps.`);

    // Step 4: Enrich with public API intelligence
    const relevantAPIs = queryRegistry(blueprint.capabilities, blueprint.domainKnowledge);
    const apiContext = formatAPIsForContext(relevantAPIs);
    if (relevantAPIs.length > 0) {
        onStatus(`Found ${relevantAPIs.length} relevant public APIs for this project.`);
    }

    // Step 5: Format context for system prompt
    const contextForPrompt = formatIntelligenceContext(blueprint, research, assessment);

    // Also merge hardcoded skills that ARE relevant
    const matchedSkills = identifySkills(userPrompt);
    const skillContext = matchedSkills.length > 0
        ? `\n\n## Loaded Expert Skills\n${matchedSkills.map(s => `- **${s.name}**: ${s.corePatterns.slice(0, 200)}`).join("\n")}`
        : "";

    return {
        blueprint,
        research,
        assessment,
        contextForPrompt: contextForPrompt + skillContext + apiContext,
    };
}

/** Format all intelligence into a context string for the system prompt */
function formatIntelligenceContext(
    blueprint: AppBlueprint,
    research: ResearchReport,
    assessment: IntelligenceAssessment,
): string {
    const sections: string[] = [];

    // Blueprint summary
    sections.push(`## App Blueprint — What We're Building
**${blueprint.appDescription}**
**Complexity:** ${blueprint.complexity}
**Architecture:** ${blueprint.architecture}`);

    // Per-subsystem architecture (detailed for complex/expert, simple list otherwise)
    if (blueprint.subsystemSpecs.length > 0) {
        sections.push(`### Subsystem Architecture (${blueprint.subsystemSpecs.length} subsystems)\n` +
            blueprint.subsystemSpecs.map(spec => {
                let entry = `#### ${spec.name}\n**Purpose:** ${spec.purpose}`;
                if (spec.files.length > 0) {
                    entry += `\n**Files:** ${spec.files.join(', ')}`;
                }
                if (spec.interfaces.length > 0) {
                    entry += `\n**Interfaces:** ${spec.interfaces.join(', ')}`;
                }
                if (spec.dataModels.length > 0) {
                    entry += `\n**Data Models:** ${spec.dataModels.join(', ')}`;
                }
                if (spec.externalAPIs && spec.externalAPIs.length > 0) {
                    entry += `\n**External APIs:** ${spec.externalAPIs.join(', ')}`;
                }
                if (spec.criticalLogic && spec.criticalLogic !== 'Needs detailed specification') {
                    entry += `\n**Critical Logic:** ${spec.criticalLogic}`;
                }
                if (spec.dependsOn.length > 0) {
                    entry += `\n**Depends On:** ${spec.dependsOn.join(', ')}`;
                }
                return entry;
            }).join('\n\n'));
    } else {
        sections.push(`### Subsystems\n${blueprint.subsystems.map(s => `- ${s}`).join("\n")}`);
    }

    sections.push(`### Key Capabilities Required
${blueprint.capabilities.map(c => `- ${c}`).join("\n")}

### Recommended Libraries & APIs
${blueprint.libraries.map(l => `- ${l}`).join("\n")}

### Domain Knowledge Needed
${blueprint.domainKnowledge.map(d => `- ${d}`).join("\n")}`);

    // Research findings (key ones only to avoid prompt bloat)
    if (research.findings.length > 0) {
        const topFindings = research.findings.slice(0, 6);
        sections.push(`## 🔍 Research Findings
${topFindings.map(f => {
            let entry = `### ${f.topic}\n${f.knowledge.slice(0, 400)}`;
            if (f.patterns.length > 0) {
                entry += `\n**Patterns:** ${f.patterns.slice(0, 3).join("; ")}`;
            }
            if (f.pitfalls.length > 0) {
                entry += `\n**⚠️ Pitfalls:** ${f.pitfalls.slice(0, 2).join("; ")}`;
            }
            return entry;
        }).join("\n\n")}`);

        if (research.architectureInsights) {
            sections.push(`### Architecture Insights (from real-world examples)
${research.architectureInsights.slice(0, 600)}`);
        }
    }

    // Self-assessment
    sections.push(`## 🪞 Honest Self-Assessment
${assessment.narrative}

### Per-Subsystem Confidence
${assessment.subsystemAssessments.map(a => {
        const icon = a.confidence === "high" ? "🟢" : a.confidence === "medium" ? "🟡" : a.confidence === "low" ? "🟠" : "🔴";
        return `${icon} **${a.name}**: ${a.confidence} — ${a.reasoning}${a.gapsInKnowledge.length > 0 ? `\n  Gaps: ${a.gapsInKnowledge.join(", ")}` : ""}`;
    }).join("\n")}

### Critical Gaps (MUST research before/during building)
${assessment.criticalGaps.map(g => `- ⚠️ ${g}`).join("\n")}

### Learning Priority (research these in order when needed)
${assessment.learningPriority.map((p, i) => `${i + 1}. ${p}`).join("\n")}`);

    return sections.join("\n\n");
}

/* ═══════════════════════════════════════════
   LEGACY COMPATIBILITY — Keep existing imports working
   ═══════════════════════════════════════════ */

// These are kept for backward compatibility but the real intelligence
// now comes from the LLM-powered functions above.

export interface SkillGapAnalysis {
    knownSkills: SkillProfile[];
    unknownTech: string[];
    coverageScore: number;
    confidenceScore: number;
    assessment: string;
}

export interface LearnedSkill extends SkillProfile {
    learnedAt: number;
    source: "tavily" | "llm" | "cached";
    isDynamic: true;
}

/** Legacy: basic skill gap detection. Use runPreFlightIntelligence instead. */
export function detectSkillGaps(prompt: string): SkillGapAnalysis {
    const matchedSkills = identifySkills(prompt);
    return {
        knownSkills: matchedSkills,
        unknownTech: [],
        coverageScore: matchedSkills.length > 0 ? 0.7 : 0.3,
        confidenceScore: matchedSkills.length > 0 ? 0.7 : 0.3,
        assessment: matchedSkills.length > 0
            ? `Loaded ${matchedSkills.length} skill profile(s). Deep intelligence will analyze further.`
            : "No pre-loaded skill profiles match. Deep intelligence will decompose requirements.",
    };
}

/** Legacy: no-op for backward compat. Use deepResearch instead. */
export async function learnMissingSkills(_unknownTech: string[]): Promise<LearnedSkill[]> {
    return []; // Replaced by runPreFlightIntelligence
}

/** Legacy: returns hardcoded profiles. Real intelligence comes from LLM decomposition. */
export function buildFullSkillContext(prompt: string): {
    context: string;
    skills: SkillProfile[];
    gaps: SkillGapAnalysis;
} {
    const gaps = detectSkillGaps(prompt);
    const context = gaps.knownSkills.length > 0
        ? gaps.knownSkills.map(s => `### ${s.name}\n${s.corePatterns}`).join("\n\n---\n\n")
        : "";
    return { context, skills: gaps.knownSkills, gaps };
}
