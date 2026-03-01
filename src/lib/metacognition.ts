/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Metacognition Engine
   
   The agent's self-awareness layer. It grades its own output quality,
   tracks success/failure rates, analyzes build failures, and maintains a
   persistent learning memory so it never makes the same mistake twice.
   
   The agent can answer: "How intelligent am I right now?"
   ═══════════════════════════════════════════════════════════════════ */

import fs from "fs/promises";
import path from "path";

/* ─── Types ─── */

export interface QualityReport {
    /** 0–100 quality score for this specific tool result */
    score: number;
    /** What went well */
    positives: string[];
    /** Issues detected */
    issues: string[];
    /** Suggested improvements */
    suggestions: string[];
    /** Tool name this report is for */
    toolName: string;
    /** Timestamp */
    timestamp: number;
}

export interface BuildDiagnosis {
    /** Category of error: type_error, missing_import, syntax, runtime, dependency */
    category: "type_error" | "missing_import" | "syntax" | "runtime" | "dependency" | "config" | "unknown";
    /** Parsed error messages */
    errors: ParsedError[];
    /** Auto-generated fix strategy */
    fixStrategy: string;
    /** Whether this error pattern has been seen before */
    previouslySeen: boolean;
    /** Stored fix from last time (if previously seen) */
    previousFix?: string;
}

export interface ParsedError {
    /** File path from the error output */
    file?: string;
    /** Line number */
    line?: number;
    /** Error code (TS2304, E0001, etc.) */
    code?: string;
    /** Error message */
    message: string;
}

export interface IntelligenceReport {
    /** % of project tech stack covered by loaded skills */
    skillCoverage: number;
    /** Historical task success rate (0-100) */
    taskSuccessRate: number;
    /** % of builds that pass on first try */
    buildPassRate: number;
    /** Recognized weak areas */
    knownWeaknesses: string[];
    /** Recently acquired knowledge */
    recentLearnings: string[];
    /** Total tool calls executed this session */
    totalToolCalls: number;
    /** Total errors encountered */
    totalErrors: number;
    /** How the agent should present this to the user */
    selfAssessment: string;
}

export interface LearningMemory {
    /** Skills learned dynamically during sessions */
    learnedSkills: string[];
    /** Error signature → fix mapping for auto-repair */
    errorPatterns: Record<string, string>;
    /** Patterns that have worked well */
    successfulPatterns: string[];
    /** Project-specific insights */
    projectInsights: string[];
    /** Timestamp of last project scan */
    lastScanTimestamp: number;
    /** Session metrics */
    metrics: SessionMetrics;
}

interface SessionMetrics {
    toolCallsTotal: number;
    toolCallsSuccessful: number;
    toolCallsFailed: number;
    buildsTotal: number;
    buildsPassedFirstTry: number;
    buildsFailed: number;
    filesCreated: number;
    filesEdited: number;
    errorsAutoFixed: number;
}

/* ═══════════════════════════════════════════
   QUALITY GRADING — Grade each tool result
   ═══════════════════════════════════════════ */

/**
 * Grade the quality of a tool execution result.
 * Returns a 0-100 score with specific feedback.
 */
export function gradeToolResult(
    toolName: string,
    args: Record<string, unknown>,
    result: { success: boolean; output: string; error?: string },
): QualityReport {
    const report: QualityReport = {
        score: 100,
        positives: [],
        issues: [],
        suggestions: [],
        toolName,
        timestamp: Date.now(),
    };

    // Base score: failed tools start at 0
    if (!result.success) {
        report.score = 0;
        report.issues.push(`Tool failed: ${result.error || "unknown error"}`);
        return report;
    }

    switch (toolName) {
        case "create_file":
            gradeCreateFile(args, result, report);
            break;
        case "edit_file":
            gradeEditFile(args, result, report);
            break;
        case "run_command":
            gradeRunCommand(args, result, report);
            break;
        default:
            report.positives.push(`${toolName} executed successfully`);
    }

    // Clamp score
    report.score = Math.max(0, Math.min(100, report.score));
    return report;
}

function gradeCreateFile(
    args: Record<string, unknown>,
    result: { success: boolean; output: string },
    report: QualityReport,
): void {
    const content = (args.content as string) || "";
    const filePath = (args.path as string) || "";

    // Check for TypeScript best practices
    if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) {
        if (content.includes(": any")) {
            report.score -= 15;
            report.issues.push("Contains `any` type — use specific types");
        }
        if (!content.includes("export")) {
            report.score -= 5;
            report.issues.push("No exports detected — file may be orphaned");
        }
        if (content.includes("// @ts-ignore") || content.includes("// @ts-nocheck")) {
            report.score -= 20;
            report.issues.push("TypeScript safety suppressed — fix types instead");
        }
        if (content.includes("\"use strict\"")) {
            report.score -= 5;
            report.suggestions.push("\"use strict\" unnecessary in TypeScript modules");
        }
        report.positives.push("TypeScript file created");
    }

    // Check for console.log in production code
    if (content.includes("console.log") && !filePath.includes("test") && !filePath.includes("debug")) {
        report.score -= 5;
        report.suggestions.push("Contains console.log — consider using a proper logger");
    }

    // Check file size
    if (content.length > 10000) {
        report.score -= 10;
        report.suggestions.push("File is large (>10KB) — consider splitting into modules");
    }

    if (content.length > 0 && report.issues.length === 0) {
        report.positives.push("File created with valid content");
    }
}

function gradeEditFile(
    args: Record<string, unknown>,
    result: { success: boolean; output: string },
    report: QualityReport,
): void {
    const search = (args.search as string) || "";
    const replace = (args.replace as string) || "";

    if (search === replace) {
        report.score -= 50;
        report.issues.push("Search and replace strings are identical — no actual change");
    }

    if (search.length < 5) {
        report.score -= 20;
        report.issues.push("Very short search string — high risk of unintended matches");
    }

    if (result.output.includes("not found") || result.output.includes("No match")) {
        report.score = 10;
        report.issues.push("Search string not found in file — edit had no effect");
    }

    if (report.issues.length === 0) {
        report.positives.push("Edit applied successfully");
    }
}

function gradeRunCommand(
    args: Record<string, unknown>,
    result: { success: boolean; output: string },
    report: QualityReport,
): void {
    const output = result.output;

    // Check for build/test pass
    if (output.includes("Exit code: 0")) {
        report.positives.push("Command completed successfully (exit 0)");
    } else if (output.includes("Exit code:")) {
        report.score -= 40;
        report.issues.push("Command exited with non-zero status");
    }

    // Check for warnings
    const warningCount = (output.match(/warning/gi) || []).length;
    if (warningCount > 0) {
        report.score -= Math.min(warningCount * 3, 20);
        report.suggestions.push(`${warningCount} warning(s) in output — consider fixing`);
    }

    // Check for deprecation
    if (output.includes("deprecated")) {
        report.score -= 5;
        report.suggestions.push("Deprecated API usage detected — consider updating");
    }

    // npm/package errors
    if (output.includes("ENOENT") || output.includes("MODULE_NOT_FOUND")) {
        report.score -= 30;
        report.issues.push("Missing file or module — check paths and dependencies");
    }
}

/* ═══════════════════════════════════════════
   BUILD FAILURE ANALYSIS
   ═══════════════════════════════════════════ */

/**
 * Analyze build/compile failure output and generate diagnosis + fix strategy.
 */
export function analyzeBuildFailure(
    stderr: string,
    memory?: LearningMemory,
): BuildDiagnosis {
    const errors = parseErrors(stderr);
    const category = categorizeErrors(errors);

    // Check if we've seen this pattern before
    const errorSignature = errors.map(e => e.code || e.message.slice(0, 50)).join("|");
    const previousFix = memory?.errorPatterns?.[errorSignature];

    const fixStrategy = previousFix
        ? `PREVIOUSLY FIXED: ${previousFix}`
        : generateFixStrategy(category, errors);

    return {
        category,
        errors,
        fixStrategy,
        previouslySeen: !!previousFix,
        previousFix,
    };
}

/** Parse error messages from build output */
function parseErrors(output: string): ParsedError[] {
    const errors: ParsedError[] = [];
    const lines = output.split("\n");

    for (const line of lines) {
        // TypeScript errors: src/file.ts(10,5): error TS2304: Cannot find name 'x'
        const tsMatch = line.match(/(.+?)\((\d+),\d+\):\s*error\s*(TS\d+):\s*(.+)/);
        if (tsMatch) {
            errors.push({
                file: tsMatch[1],
                line: parseInt(tsMatch[2]),
                code: tsMatch[3],
                message: tsMatch[4],
            });
            continue;
        }

        // ESLint style: /path/file.ts:10:5 - error: message
        const eslintMatch = line.match(/(.+?):(\d+):\d+\s*[-–]\s*error[:]?\s*(.+)/);
        if (eslintMatch) {
            errors.push({
                file: eslintMatch[1],
                line: parseInt(eslintMatch[2]),
                message: eslintMatch[3],
            });
            continue;
        }

        // Generic error lines
        const genericMatch = line.match(/error[:\s]+(.+)/i);
        if (genericMatch && errors.length < 10) {
            errors.push({ message: genericMatch[1].trim() });
        }
    }

    return errors.slice(0, 20); // Cap at 20 errors
}

/** Categorize the dominant error type */
function categorizeErrors(errors: ParsedError[]): BuildDiagnosis["category"] {
    if (errors.length === 0) return "unknown";

    const messages = errors.map(e => e.message.toLowerCase()).join(" ");
    const codes = errors.map(e => e.code).filter(Boolean);

    if (codes.some(c => c && ["TS2304", "TS2305", "TS2307", "TS2614"].includes(c))) return "missing_import";
    if (codes.some(c => c && c.startsWith("TS"))) return "type_error";
    if (messages.includes("unexpected token") || messages.includes("syntax error")) return "syntax";
    if (messages.includes("cannot find module") || messages.includes("module not found")) return "dependency";
    if (messages.includes("enoent") || messages.includes("not found")) return "dependency";
    if (messages.includes("runtime") || messages.includes("uncaught")) return "runtime";
    if (messages.includes("tsconfig") || messages.includes("configuration")) return "config";

    return "type_error"; // Default for TS projects
}

/** Generate a fix strategy based on error category */
function generateFixStrategy(category: BuildDiagnosis["category"], errors: ParsedError[]): string {
    switch (category) {
        case "missing_import":
            return `MISSING IMPORTS: ${errors.map(e => `"${e.message}" in ${e.file || "unknown file"}:${e.line || "?"}`).join("; ")}. FIX: Add the missing import statements. Check the symbol index with find_symbol first.`;

        case "type_error":
            return `TYPE ERRORS: ${errors.length} type error(s). FIX: Check each error — likely wrong type assignments, missing type declarations, or incompatible interfaces. Use find_symbol to verify correct types.`;

        case "syntax":
            return `SYNTAX ERRORS: Fix syntax issues — likely missing brackets, semicolons, or invalid expressions. Check the file at the error line.`;

        case "dependency":
            return `MISSING DEPENDENCY: Package or module not found. FIX: Run npm install for missing packages, or check import paths for local modules.`;

        case "runtime":
            return `RUNTIME ERROR: Code compiles but crashes. FIX: Check the stack trace, verify null checks, and test edge cases.`;

        case "config":
            return `CONFIGURATION ERROR: Check tsconfig.json, next.config.js, or other config files. Verify paths and compiler options.`;

        default:
            return `UNKNOWN ERROR TYPE: Analyze the error output carefully and fix each issue one at a time.`;
    }
}

/* ═══════════════════════════════════════════
   INTELLIGENCE REPORT — Self-assessment
   ═══════════════════════════════════════════ */

/**
 * Generate a full intelligence report — the agent's self-assessment.
 */
export function getIntelligenceReport(
    skillCoverage: number,
    memory: LearningMemory,
): IntelligenceReport {
    const m = memory.metrics;

    const taskSuccessRate = m.toolCallsTotal === 0
        ? 100
        : Math.round((m.toolCallsSuccessful / m.toolCallsTotal) * 100);

    const buildPassRate = m.buildsTotal === 0
        ? 100
        : Math.round((m.buildsPassedFirstTry / m.buildsTotal) * 100);

    // Detect weaknesses from error patterns
    const knownWeaknesses: string[] = [];
    const errorEntries = Object.entries(memory.errorPatterns);
    if (errorEntries.length > 5) knownWeaknesses.push("Frequent build errors — may need deeper skill knowledge");
    if (m.toolCallsFailed > m.toolCallsSuccessful * 0.3) knownWeaknesses.push("High tool failure rate — check environment setup");
    if (skillCoverage < 0.5) knownWeaknesses.push("Low skill coverage — many technologies not yet learned");

    // Build self-assessment narrative
    const overall = (taskSuccessRate + buildPassRate + skillCoverage * 100) / 3;
    let selfAssessment: string;

    if (overall >= 85) {
        selfAssessment = `🟢 HIGH INTELLIGENCE — ${Math.round(overall)}% overall. Skill coverage at ${Math.round(skillCoverage * 100)}%, build pass rate ${buildPassRate}%, task success rate ${taskSuccessRate}%. I am well-equipped for this task.`;
    } else if (overall >= 60) {
        selfAssessment = `🟡 MODERATE INTELLIGENCE — ${Math.round(overall)}% overall. Some gaps exist: ${knownWeaknesses.join(", ") || "none critical"}. I can proceed but should verify carefully.`;
    } else if (overall >= 35) {
        selfAssessment = `🟠 LOW INTELLIGENCE — ${Math.round(overall)}% overall. Significant gaps: ${knownWeaknesses.join(", ")}. I recommend researching before proceeding.`;
    } else {
        selfAssessment = `🔴 CRITICALLY LOW — ${Math.round(overall)}% overall. I am not well-prepared for this task. Weaknesses: ${knownWeaknesses.join(", ")}. Recommend user guidance and extensive research first.`;
    }

    return {
        skillCoverage,
        taskSuccessRate,
        buildPassRate,
        knownWeaknesses,
        recentLearnings: memory.learnedSkills.slice(-5),
        totalToolCalls: m.toolCallsTotal,
        totalErrors: m.toolCallsFailed,
        selfAssessment,
    };
}

/* ═══════════════════════════════════════════
   PERSISTENT LEARNING MEMORY
   ═══════════════════════════════════════════ */

const MEMORY_DIR = ".shellshockhive";
const MEMORY_FILE = "memory.json";

function getDefaultMemory(): LearningMemory {
    return {
        learnedSkills: [],
        errorPatterns: {},
        successfulPatterns: [],
        projectInsights: [],
        lastScanTimestamp: 0,
        metrics: {
            toolCallsTotal: 0,
            toolCallsSuccessful: 0,
            toolCallsFailed: 0,
            buildsTotal: 0,
            buildsPassedFirstTry: 0,
            buildsFailed: 0,
            filesCreated: 0,
            filesEdited: 0,
            errorsAutoFixed: 0,
        },
    };
}

/**
 * Load learning memory from workspace disk.
 */
export async function loadLearningMemory(workspace: string): Promise<LearningMemory> {
    try {
        const memPath = path.join(workspace, MEMORY_DIR, MEMORY_FILE);
        const data = await fs.readFile(memPath, "utf-8");
        return JSON.parse(data) as LearningMemory;
    } catch {
        return getDefaultMemory();
    }
}

/**
 * Save learning memory to workspace disk.
 */
export async function saveLearningMemory(workspace: string, memory: LearningMemory): Promise<void> {
    try {
        const memDir = path.join(workspace, MEMORY_DIR);
        await fs.mkdir(memDir, { recursive: true });
        const memPath = path.join(memDir, MEMORY_FILE);
        await fs.writeFile(memPath, JSON.stringify(memory, null, 2), "utf-8");
    } catch (error) {
        console.error("Failed to save learning memory:", error);
    }
}

/**
 * Record a tool execution result into learning memory.
 */
export function recordToolExecution(
    memory: LearningMemory,
    toolName: string,
    success: boolean,
    quality: QualityReport,
): LearningMemory {
    const updated = { ...memory, metrics: { ...memory.metrics } };

    updated.metrics.toolCallsTotal++;
    if (success) {
        updated.metrics.toolCallsSuccessful++;
    } else {
        updated.metrics.toolCallsFailed++;
    }

    // Track file operations
    if (toolName === "create_file") updated.metrics.filesCreated++;
    if (toolName === "edit_file") updated.metrics.filesEdited++;

    // Track builds
    if (toolName === "run_command") {
        // Detect if this was a build command
        if (quality.positives.some(p => p.includes("exit 0"))) {
            updated.metrics.buildsTotal++;
            updated.metrics.buildsPassedFirstTry++;
        } else if (quality.issues.some(i => i.includes("non-zero"))) {
            updated.metrics.buildsTotal++;
            updated.metrics.buildsFailed++;
        }
    }

    // Record successful patterns
    if (success && quality.score >= 80 && quality.positives.length > 0) {
        const pattern = `${toolName}: ${quality.positives[0]}`;
        if (!updated.successfulPatterns.includes(pattern)) {
            updated.successfulPatterns.push(pattern);
            // Keep only last 50 patterns
            if (updated.successfulPatterns.length > 50) {
                updated.successfulPatterns = updated.successfulPatterns.slice(-50);
            }
        }
    }

    return updated;
}

/**
 * Record an error pattern and its fix into learning memory.
 */
export function recordErrorFix(
    memory: LearningMemory,
    errorSignature: string,
    fixDescription: string,
): LearningMemory {
    const updated = { ...memory };
    updated.errorPatterns = { ...updated.errorPatterns, [errorSignature]: fixDescription };
    updated.metrics = { ...updated.metrics, errorsAutoFixed: (updated.metrics.errorsAutoFixed || 0) + 1 };

    // Keep error patterns manageable
    const entries = Object.entries(updated.errorPatterns);
    if (entries.length > 100) {
        updated.errorPatterns = Object.fromEntries(entries.slice(-100));
    }

    return updated;
}

/**
 * Add a project insight to learning memory.
 */
export function recordProjectInsight(memory: LearningMemory, insight: string): LearningMemory {
    const updated = { ...memory };
    if (!updated.projectInsights.includes(insight)) {
        updated.projectInsights.push(insight);
        if (updated.projectInsights.length > 30) {
            updated.projectInsights = updated.projectInsights.slice(-30);
        }
    }
    return updated;
}
