/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Project Intelligence Engine
   
   The core system that gives the agent FULL awareness of the project.
   Scans files, indexes symbols, maps dependencies, detects conventions,
   and compresses everything into ~2K tokens for context injection.
   
   This runs SERVER-SIDE via the tools API — it needs fs access.
   ═══════════════════════════════════════════════════════════════════ */

import fs from "fs/promises";
import path from "path";

/* ─── Types ─── */

export interface FileNode {
    name: string;
    relativePath: string;
    type: "file" | "directory";
    size?: number;
    extension?: string;
    children?: FileNode[];
    /** Rough category: component, lib, route, config, test, asset, style */
    category?: string;
}

export interface SymbolEntry {
    name: string;
    kind: "function" | "class" | "type" | "interface" | "const" | "enum" | "component" | "export";
    file: string;
    line: number;
    /** Whether it's a default export */
    isDefault?: boolean;
    /** Brief signature if available */
    signature?: string;
}

export interface ImportEdge {
    from: string;       // importing file
    to: string;         // imported file/module
    symbols: string[];  // what's imported
    isExternal: boolean;
}

export interface ProjectConventions {
    language: string;
    framework: string;
    fileNaming: string;         // camelCase, kebab-case, PascalCase
    componentPattern: string;   // function, class, arrow
    stateManagement: string;
    styling: string;
    testing: string;
    hasTypeScript: boolean;
    hasEslint: boolean;
    hasPrettier: boolean;
    packageManager: string;
    monorepo: boolean;
}

export interface ProjectSnapshot {
    workspace: string;
    scannedAt: number;
    /** Tree of all files and directories */
    tree: FileNode;
    /** Total counts */
    stats: {
        totalFiles: number;
        totalDirectories: number;
        totalSizeKB: number;
        filesByExtension: Record<string, number>;
    };
    /** All exported symbols across the project */
    symbols: SymbolEntry[];
    /** Import/dependency edges */
    imports: ImportEdge[];
    /** Detected project conventions */
    conventions: ProjectConventions;
    /** Package.json data if available */
    packageJson?: {
        name: string;
        dependencies: string[];
        devDependencies: string[];
        scripts: Record<string, string>;
    };
}

/* ═══════════════════════════════════════════
   FILE CATEGORIES
   ═══════════════════════════════════════════ */

const IGNORE_DIRS = new Set([
    "node_modules", ".git", ".next", "dist", "build", "out",
    ".cache", ".turbo", "__pycache__", ".venv", "venv",
    ".godot", ".import", "addons", // Godot
    "coverage", ".nyc_output",
]);

const IGNORE_FILES = new Set([
    ".DS_Store", "Thumbs.db", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
]);

function categorizeFile(relativePath: string, ext: string): string {
    const lower = relativePath.toLowerCase();

    // Tests
    if (lower.includes(".test.") || lower.includes(".spec.") || lower.includes("__tests__")) return "test";

    // Config files
    if ([".json", ".yaml", ".yml", ".toml", ".ini", ".env"].includes(ext) ||
        lower.includes("config") || lower.includes("tsconfig") ||
        lower.endsWith(".config.ts") || lower.endsWith(".config.js")) return "config";

    // Styles
    if ([".css", ".scss", ".sass", ".less", ".styl"].includes(ext)) return "style";

    // Assets
    if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".mp3", ".mp4", ".woff", ".woff2", ".ttf"].includes(ext)) return "asset";

    // Route files (Next.js, etc)
    if (lower.includes("/app/") && (lower.includes("page.") || lower.includes("layout.") || lower.includes("route."))) return "route";
    if (lower.includes("/pages/")) return "route";

    // Components
    if (lower.includes("/component") || lower.includes("/ui/")) return "component";
    if (ext === ".tsx" && !lower.includes("/lib/") && !lower.includes("/app/")) return "component";

    // Library/core logic
    if (lower.includes("/lib/") || lower.includes("/utils/") || lower.includes("/helpers/") || lower.includes("/services/")) return "lib";

    // Godot scripts
    if ([".gd", ".gdshader", ".tres", ".tscn"].includes(ext)) return "godot";

    // Python
    if (ext === ".py") return "python";

    return "source";
}

/* ═══════════════════════════════════════════
   PROJECT SCANNER
   ═══════════════════════════════════════════ */

export async function scanProjectTree(
    dirPath: string,
    relativeTo: string = dirPath,
    depth: number = 0,
    maxDepth: number = 8,
): Promise<{ tree: FileNode; stats: { totalFiles: number; totalDirectories: number; totalSizeKB: number; filesByExtension: Record<string, number> } }> {

    const stats = { totalFiles: 0, totalDirectories: 0, totalSizeKB: 0, filesByExtension: {} as Record<string, number> };

    async function walk(dir: string, currentDepth: number): Promise<FileNode> {
        const relPath = path.relative(relativeTo, dir).replace(/\\/g, "/") || ".";
        const dirName = path.basename(dir);

        const node: FileNode = {
            name: dirName,
            relativePath: relPath,
            type: "directory",
            children: [],
        };

        if (currentDepth > maxDepth) return node;

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            // Sort: directories first, then files alphabetically
            const sorted = entries.sort((a, b) => {
                if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
                return a.name.localeCompare(b.name);
            });

            for (const entry of sorted) {
                if (IGNORE_DIRS.has(entry.name) && entry.isDirectory()) continue;
                if (IGNORE_FILES.has(entry.name)) continue;

                const fullPath = path.join(dir, entry.name);

                if (entry.isDirectory()) {
                    stats.totalDirectories++;
                    const childNode = await walk(fullPath, currentDepth + 1);
                    node.children!.push(childNode);
                } else {
                    try {
                        const fileStat = await fs.stat(fullPath);
                        const ext = path.extname(entry.name).toLowerCase();
                        const fileRelPath = path.relative(relativeTo, fullPath).replace(/\\/g, "/");

                        stats.totalFiles++;
                        stats.totalSizeKB += fileStat.size / 1024;
                        stats.filesByExtension[ext] = (stats.filesByExtension[ext] || 0) + 1;

                        node.children!.push({
                            name: entry.name,
                            relativePath: fileRelPath,
                            type: "file",
                            size: fileStat.size,
                            extension: ext,
                            category: categorizeFile(fileRelPath, ext),
                        });
                    } catch {
                        // Skip unreadable files
                    }
                }
            }
        } catch {
            // Skip unreadable directories
        }

        return node;
    }

    const tree = await walk(dirPath, 0);
    return { tree, stats };
}


/* ═══════════════════════════════════════════
   SYMBOL INDEX — Regex-based (no AST needed)
   ═══════════════════════════════════════════ */

const SYMBOL_PATTERNS = [
    // TypeScript/JavaScript exports
    { regex: /^export\s+(?:default\s+)?function\s+(\w+)/gm, kind: "function" as const, isDefault: false },
    { regex: /^export\s+default\s+function\s+(\w+)/gm, kind: "function" as const, isDefault: true },
    { regex: /^export\s+(?:const|let|var)\s+(\w+)/gm, kind: "const" as const, isDefault: false },
    { regex: /^export\s+(?:default\s+)?class\s+(\w+)/gm, kind: "class" as const, isDefault: false },
    { regex: /^export\s+type\s+(\w+)/gm, kind: "type" as const, isDefault: false },
    { regex: /^export\s+interface\s+(\w+)/gm, kind: "interface" as const, isDefault: false },
    { regex: /^export\s+enum\s+(\w+)/gm, kind: "enum" as const, isDefault: false },
    // Default exports (various forms)
    { regex: /^export\s+default\s+(\w+)/gm, kind: "export" as const, isDefault: true },
    // React components (function Name() or const Name = )
    { regex: /^(?:export\s+(?:default\s+)?)?function\s+([A-Z]\w+)\s*\(/gm, kind: "component" as const, isDefault: false },

    // Python exports
    { regex: /^def\s+(\w+)\s*\(/gm, kind: "function" as const, isDefault: false },
    { regex: /^class\s+(\w+)/gm, kind: "class" as const, isDefault: false },
    { regex: /^(\w+)\s*=\s*/gm, kind: "const" as const, isDefault: false },

    // GDScript (Godot)
    { regex: /^func\s+(\w+)\s*\(/gm, kind: "function" as const, isDefault: false },
    { regex: /^class_name\s+(\w+)/gm, kind: "class" as const, isDefault: false },
    { regex: /^var\s+(\w+)/gm, kind: "const" as const, isDefault: false },
    { regex: /^signal\s+(\w+)/gm, kind: "const" as const, isDefault: false },
];

const INDEXABLE_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
    ".py", ".gd",
    ".rs", // Rust
]);

export async function extractSymbols(filePath: string, relativePath: string): Promise<SymbolEntry[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (!INDEXABLE_EXTENSIONS.has(ext)) return [];

    try {
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const symbols: SymbolEntry[] = [];
        const seen = new Set<string>();

        for (const pattern of SYMBOL_PATTERNS) {
            // Only apply language-specific patterns
            if (ext === ".py" && !["def ", "class "].some(p => pattern.regex.source.includes(p.trim()))) continue;
            if (ext === ".gd" && !["func ", "class_name ", "var ", "signal "].some(p => pattern.regex.source.includes(p.trim()))) continue;

            // Reset regex state
            pattern.regex.lastIndex = 0;
            let match;

            while ((match = pattern.regex.exec(content)) !== null) {
                const name = match[1];
                if (!name || seen.has(name)) continue;

                // Skip common false positives
                if (name.length <= 1 || ["if", "else", "for", "while", "return", "import", "from", "const", "let", "var"].includes(name)) continue;

                seen.add(name);

                // Find line number
                const beforeMatch = content.substring(0, match.index);
                const lineNumber = beforeMatch.split("\n").length;

                // Get brief signature (the match line, truncated)
                const matchLine = lines[lineNumber - 1]?.trim().slice(0, 100);

                symbols.push({
                    name,
                    kind: pattern.kind,
                    file: relativePath,
                    line: lineNumber,
                    isDefault: pattern.isDefault,
                    signature: matchLine,
                });
            }
        }

        return symbols;
    } catch {
        return [];
    }
}

/* ═══════════════════════════════════════════
   DEPENDENCY GRAPH — Import extraction
   ═══════════════════════════════════════════ */

const IMPORT_PATTERNS = [
    // ES6: import { x, y } from "./module"
    /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g,
    // ES6: import Name from "./module"
    /import\s+(\w+)\s+from\s+["']([^"']+)["']/g,
    // ES6: import * as x from "./module"
    /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/g,
    // CommonJS: const x = require("./module")
    /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\s*\(\s*["']([^"']+)["']\s*\)/g,
    // Python: from module import x, y
    /from\s+([\w.]+)\s+import\s+(.+)/g,
    // Python: import module
    /^import\s+([\w.]+)/gm,
    // GDScript: preload/load
    /(?:preload|load)\s*\(\s*["']([^"']+)["']\s*\)/g,
];

export async function extractImports(filePath: string, relativePath: string): Promise<ImportEdge[]> {
    const ext = path.extname(filePath).toLowerCase();
    if (!INDEXABLE_EXTENSIONS.has(ext)) return [];

    try {
        const content = await fs.readFile(filePath, "utf-8");
        const edges: ImportEdge[] = [];
        const seen = new Set<string>();

        for (const pattern of IMPORT_PATTERNS) {
            const regex = new RegExp(pattern.source, pattern.flags);
            let match;

            while ((match = regex.exec(content)) !== null) {
                let symbols: string[] = [];
                let modulePath = "";

                if (match.length === 4 && match[3]) {
                    // CommonJS
                    symbols = (match[1] || match[2] || "").split(",").map(s => s.trim()).filter(Boolean);
                    modulePath = match[3];
                } else if (match.length === 3) {
                    // ES6 or Python
                    symbols = match[1].split(",").map(s => s.trim()).filter(Boolean);
                    modulePath = match[2];
                } else if (match.length === 2) {
                    // Simple import or GDScript preload
                    modulePath = match[1];
                }

                if (!modulePath || seen.has(modulePath)) continue;
                seen.add(modulePath);

                const isExternal = !modulePath.startsWith(".") && !modulePath.startsWith("/") && !modulePath.startsWith("@/") && !modulePath.startsWith("res://");

                edges.push({
                    from: relativePath,
                    to: modulePath,
                    symbols,
                    isExternal,
                });
            }
        }

        return edges;
    } catch {
        return [];
    }
}


/* ═══════════════════════════════════════════
   CONVENTION DETECTOR
   ═══════════════════════════════════════════ */

export async function detectConventions(workspace: string, tree: FileNode): Promise<ProjectConventions> {
    const conventions: ProjectConventions = {
        language: "unknown",
        framework: "unknown",
        fileNaming: "unknown",
        componentPattern: "unknown",
        stateManagement: "none",
        styling: "css",
        testing: "none",
        hasTypeScript: false,
        hasEslint: false,
        hasPrettier: false,
        packageManager: "npm",
        monorepo: false,
    };

    // Check for config files
    const rootFiles = new Set((tree.children || []).map(c => c.name));

    // TypeScript
    conventions.hasTypeScript = rootFiles.has("tsconfig.json");
    conventions.language = conventions.hasTypeScript ? "typescript" : "javascript";

    // Linting / formatting
    conventions.hasEslint = rootFiles.has(".eslintrc.json") || rootFiles.has(".eslintrc.js") || rootFiles.has("eslint.config.js") || rootFiles.has("eslint.config.mjs");
    conventions.hasPrettier = rootFiles.has(".prettierrc") || rootFiles.has(".prettierrc.json") || rootFiles.has("prettier.config.js");

    // Package manager
    if (rootFiles.has("pnpm-lock.yaml") || rootFiles.has("pnpm-workspace.yaml")) conventions.packageManager = "pnpm";
    else if (rootFiles.has("yarn.lock")) conventions.packageManager = "yarn";
    else if (rootFiles.has("bun.lockb")) conventions.packageManager = "bun";

    // Monorepo
    conventions.monorepo = rootFiles.has("pnpm-workspace.yaml") || rootFiles.has("lerna.json") || rootFiles.has("turbo.json");

    // Framework detection from package.json
    try {
        const pkgPath = path.join(workspace, "package.json");
        const pkgContent = await fs.readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(pkgContent);
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (allDeps["next"]) conventions.framework = "nextjs";
        else if (allDeps["@remix-run/react"]) conventions.framework = "remix";
        else if (allDeps["nuxt"]) conventions.framework = "nuxt";
        else if (allDeps["svelte"]) conventions.framework = "svelte";
        else if (allDeps["react"]) conventions.framework = "react";
        else if (allDeps["vue"]) conventions.framework = "vue";
        else if (allDeps["express"]) conventions.framework = "express";
        else if (allDeps["fastify"]) conventions.framework = "fastify";

        // State management
        if (allDeps["zustand"]) conventions.stateManagement = "zustand";
        else if (allDeps["redux"] || allDeps["@reduxjs/toolkit"]) conventions.stateManagement = "redux";
        else if (allDeps["jotai"]) conventions.stateManagement = "jotai";
        else if (allDeps["recoil"]) conventions.stateManagement = "recoil";
        else if (allDeps["mobx"]) conventions.stateManagement = "mobx";

        // Styling
        if (allDeps["tailwindcss"]) conventions.styling = "tailwind";
        else if (allDeps["styled-components"]) conventions.styling = "styled-components";
        else if (allDeps["@emotion/react"]) conventions.styling = "emotion";
        else if (allDeps["sass"]) conventions.styling = "scss";

        // Testing
        if (allDeps["vitest"]) conventions.testing = "vitest";
        else if (allDeps["jest"]) conventions.testing = "jest";
        else if (allDeps["@playwright/test"]) conventions.testing = "playwright";
        else if (allDeps["cypress"]) conventions.testing = "cypress";
    } catch {
        // No package.json or not parseable
    }

    // Godot detection
    if (rootFiles.has("project.godot")) {
        conventions.language = "gdscript";
        conventions.framework = "godot";
    }

    // Python detection
    if (rootFiles.has("requirements.txt") || rootFiles.has("pyproject.toml") || rootFiles.has("setup.py")) {
        conventions.language = "python";
        try {
            const reqPath = path.join(workspace, "requirements.txt");
            const reqs = await fs.readFile(reqPath, "utf-8");
            if (reqs.includes("fastapi")) conventions.framework = "fastapi";
            else if (reqs.includes("django")) conventions.framework = "django";
            else if (reqs.includes("flask")) conventions.framework = "flask";
        } catch { /* ignore */ }
    }

    // File naming convention detection
    const fileNames = collectFileNames(tree);
    const kebabCount = fileNames.filter(n => /^[a-z][a-z0-9]*(-[a-z0-9]+)+/.test(n)).length;
    const camelCount = fileNames.filter(n => /^[a-z][a-zA-Z0-9]+/.test(n) && !n.includes("-")).length;
    const pascalCount = fileNames.filter(n => /^[A-Z][a-zA-Z0-9]+/.test(n)).length;

    if (pascalCount > kebabCount && pascalCount > camelCount) conventions.fileNaming = "PascalCase";
    else if (kebabCount > camelCount) conventions.fileNaming = "kebab-case";
    else conventions.fileNaming = "camelCase";

    return conventions;
}

function collectFileNames(node: FileNode): string[] {
    const names: string[] = [];
    if (node.type === "file") {
        const baseName = node.name.replace(/\.[^.]+$/, "");
        names.push(baseName);
    }
    for (const child of node.children || []) {
        names.push(...collectFileNames(child));
    }
    return names;
}


/* ═══════════════════════════════════════════
   PACKAGE.JSON PARSER
   ═══════════════════════════════════════════ */

async function parsePackageJson(workspace: string): Promise<ProjectSnapshot["packageJson"] | undefined> {
    try {
        const content = await fs.readFile(path.join(workspace, "package.json"), "utf-8");
        const pkg = JSON.parse(content);
        return {
            name: pkg.name || "unknown",
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
            scripts: pkg.scripts || {},
        };
    } catch {
        return undefined;
    }
}


/* ═══════════════════════════════════════════
   FULL PROJECT SCAN — Main entry point
   ═══════════════════════════════════════════ */

export async function scanFullProject(workspace: string): Promise<ProjectSnapshot> {
    // 1. Scan file tree
    const { tree, stats } = await scanProjectTree(workspace);

    // 2. Extract symbols and imports from all indexable files
    const allSymbols: SymbolEntry[] = [];
    const allImports: ImportEdge[] = [];

    async function indexFiles(node: FileNode) {
        if (node.type === "file" && node.extension && INDEXABLE_EXTENSIONS.has(node.extension)) {
            const fullPath = path.join(workspace, node.relativePath);
            const [symbols, imports] = await Promise.all([
                extractSymbols(fullPath, node.relativePath),
                extractImports(fullPath, node.relativePath),
            ]);
            allSymbols.push(...symbols);
            allImports.push(...imports);
        }
        if (node.children) {
            await Promise.all(node.children.map(indexFiles));
        }
    }
    await indexFiles(tree);

    // 3. Detect conventions
    const conventions = await detectConventions(workspace, tree);

    // 4. Parse package.json
    const packageJson = await parsePackageJson(workspace);

    return {
        workspace,
        scannedAt: Date.now(),
        tree,
        stats: {
            ...stats,
            totalSizeKB: Math.round(stats.totalSizeKB),
        },
        symbols: allSymbols,
        imports: allImports,
        conventions,
        packageJson,
    };
}


/* ═══════════════════════════════════════════
   CONTEXT COMPRESSOR — Fit into ~2K tokens
   ═══════════════════════════════════════════ */

export function compressProjectContext(snapshot: ProjectSnapshot): string {
    const lines: string[] = [];

    // ── Project overview
    lines.push(`## Project: ${snapshot.packageJson?.name || path.basename(snapshot.workspace)}`);
    lines.push(`Language: ${snapshot.conventions.language} | Framework: ${snapshot.conventions.framework}`);
    lines.push(`Files: ${snapshot.stats.totalFiles} | Dirs: ${snapshot.stats.totalDirectories} | Size: ${snapshot.stats.totalSizeKB}KB`);

    if (snapshot.packageJson) {
        lines.push(`Dependencies: ${snapshot.packageJson.dependencies.join(", ")}`);
        lines.push(`Scripts: ${Object.keys(snapshot.packageJson.scripts).join(", ")}`);
    }

    // ── File structure (compact tree)
    lines.push(`\n### File Structure`);
    function printTree(node: FileNode, indent: string = "") {
        if (node.type === "directory" && node.children && node.children.length > 0) {
            lines.push(`${indent}${node.name}/`);
            // Only show first 20 children, collapse rest
            const max = 20;
            const children = node.children;
            for (let i = 0; i < Math.min(children.length, max); i++) {
                printTree(children[i], indent + "  ");
            }
            if (children.length > max) {
                lines.push(`${indent}  ... and ${children.length - max} more`);
            }
        } else if (node.type === "file") {
            const sizeStr = node.size ? ` (${(node.size / 1024).toFixed(1)}KB)` : "";
            const catStr = node.category ? ` [${node.category}]` : "";
            lines.push(`${indent}${node.name}${sizeStr}${catStr}`);
        }
    }
    printTree(snapshot.tree);

    // ── Key symbols (top exports)
    const topSymbols = snapshot.symbols
        .filter(s => s.kind !== "const" || s.isDefault)
        .slice(0, 50);

    if (topSymbols.length > 0) {
        lines.push(`\n### Exported Symbols`);
        // Group by file
        const byFile = new Map<string, SymbolEntry[]>();
        for (const sym of topSymbols) {
            const existing = byFile.get(sym.file) || [];
            existing.push(sym);
            byFile.set(sym.file, existing);
        }
        Array.from(byFile.entries()).forEach(([file, syms]: [string, SymbolEntry[]]) => {
            const symList = syms.map((s: SymbolEntry) => `${s.name}(${s.kind})`).join(", ");
            lines.push(`  ${file}: ${symList}`);
        });
    }

    // ── Internal imports (dependency map)
    const internalImports = snapshot.imports.filter(i => !i.isExternal);
    if (internalImports.length > 0) {
        lines.push(`\n### Internal Dependencies`);
        for (const imp of internalImports.slice(0, 30)) {
            lines.push(`  ${imp.from} → ${imp.to} [${imp.symbols.join(", ")}]`);
        }
    }

    // ── Conventions
    lines.push(`\n### Conventions`);
    lines.push(`Naming: ${snapshot.conventions.fileNaming} | Components: ${snapshot.conventions.componentPattern}`);
    lines.push(`State: ${snapshot.conventions.stateManagement} | Style: ${snapshot.conventions.styling}`);
    lines.push(`Testing: ${snapshot.conventions.testing} | Pkg Manager: ${snapshot.conventions.packageManager}`);
    if (snapshot.conventions.hasTypeScript) lines.push(`TypeScript: strict mode`);

    return lines.join("\n");
}


/* ═══════════════════════════════════════════
   SYMBOL LOOKUP — Find specific symbols
   ═══════════════════════════════════════════ */

export function findSymbol(snapshot: ProjectSnapshot, query: string): SymbolEntry[] {
    const lower = query.toLowerCase();
    return snapshot.symbols.filter(s =>
        s.name.toLowerCase().includes(lower) ||
        s.file.toLowerCase().includes(lower)
    );
}

/** Find all files that would be affected if a given file is changed */
export function findDependents(snapshot: ProjectSnapshot, filePath: string): string[] {
    const normalizedPath = filePath.replace(/\\/g, "/");

    return snapshot.imports
        .filter(imp => {
            const importTarget = imp.to.replace(/\\/g, "/");
            // Check if the import target resolves to the given file
            return normalizedPath.includes(importTarget.replace(/^\.\//, "")) ||
                importTarget.includes(path.basename(normalizedPath, path.extname(normalizedPath)));
        })
        .map(imp => imp.from);
}

/** Check if a file already exists in the project */
export function fileExists(snapshot: ProjectSnapshot, relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, "/");

    function search(node: FileNode): boolean {
        if (node.type === "file" && node.relativePath === normalized) return true;
        return (node.children || []).some(search);
    }

    return search(snapshot.tree);
}

/** Get all files in the project as flat list */
export function getAllFiles(snapshot: ProjectSnapshot): string[] {
    const files: string[] = [];
    function collect(node: FileNode) {
        if (node.type === "file") files.push(node.relativePath);
        (node.children || []).forEach(collect);
    }
    collect(snapshot.tree);
    return files;
}
