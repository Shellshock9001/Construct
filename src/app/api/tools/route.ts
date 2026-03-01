import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import {
    scanFullProject,
    compressProjectContext,
    findSymbol,
    findDependents,
    extractSymbols,
    extractImports,
    type ProjectSnapshot,
} from "@/lib/projectIntelligence";
import {
    detectEnvironment,
    planInfrastructure,
    detectRequiredServices,
    healthCheckServices,
    generateEnvFile,
} from "@/lib/infrastructureEngine";
import {
    getIntelligenceReport,
    loadLearningMemory,
    saveLearningMemory,
    gradeToolResult,
    analyzeBuildFailure,
    recordToolExecution,
    recordErrorFix,
} from "@/lib/metacognition";
import { detectSkillGaps } from "@/lib/autonomousIntelligence";

/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Agent Tools API
   
   Server-side endpoints for file system operations, terminal commands,
   and directory exploration. These run on the Node.js backend so the
   agent can actually create and modify files on disk.
   ═══════════════════════════════════════════════════════════════════ */

// Safety: restrict all operations to a workspace directory
const DEFAULT_WORKSPACE = "C:\\Cursor\\Builder\\workspace";

function resolveSafe(filePath: string, workspace?: string): string {
    const base = workspace || DEFAULT_WORKSPACE;
    const resolved = path.resolve(base, filePath);
    // Prevent directory traversal
    if (!resolved.startsWith(path.resolve(base))) {
        throw new Error(`Path traversal blocked: ${filePath}`);
    }
    return resolved;
}

async function ensureWorkspace(workspace?: string) {
    const dir = workspace || DEFAULT_WORKSPACE;
    await fs.mkdir(dir, { recursive: true });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { tool, args } = body;

        await ensureWorkspace(args?.workspace);

        switch (tool) {
            /* ─── Create File ─── */
            case "create_file": {
                const filePath = resolveSafe(args.path, args.workspace);
                await fs.mkdir(path.dirname(filePath), { recursive: true });
                await fs.writeFile(filePath, args.content || "", "utf-8");
                return NextResponse.json({
                    success: true,
                    message: `Created ${args.path}`,
                    path: filePath,
                });
            }

            /* ─── Read File ─── */
            case "read_file": {
                const filePath = resolveSafe(args.path, args.workspace);
                const content = await fs.readFile(filePath, "utf-8");
                return NextResponse.json({
                    success: true,
                    content,
                    path: filePath,
                    size: Buffer.byteLength(content),
                });
            }

            /* ─── Edit File (search & replace) ─── */
            case "edit_file": {
                const filePath = resolveSafe(args.path, args.workspace);
                let content = await fs.readFile(filePath, "utf-8");
                if (!content.includes(args.search)) {
                    return NextResponse.json({
                        success: false,
                        error: `Search string not found in ${args.path}`,
                    });
                }
                content = content.replaceAll(args.search, args.replace);
                await fs.writeFile(filePath, content, "utf-8");
                return NextResponse.json({
                    success: true,
                    message: `Edited ${args.path}`,
                    path: filePath,
                });
            }

            /* ─── Delete File ─── */
            case "delete_file": {
                const filePath = resolveSafe(args.path, args.workspace);
                await fs.unlink(filePath);
                return NextResponse.json({
                    success: true,
                    message: `Deleted ${args.path}`,
                });
            }

            /* ─── List Directory ─── */
            case "list_directory": {
                const dirPath = resolveSafe(args.path || ".", args.workspace);
                const entries = await fs.readdir(dirPath, { withFileTypes: true });
                const items = await Promise.all(
                    entries.map(async (entry) => {
                        const fullPath = path.join(dirPath, entry.name);
                        try {
                            const stat = await fs.stat(fullPath);
                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? "directory" : "file",
                                size: entry.isFile() ? stat.size : undefined,
                                modified: stat.mtime.toISOString(),
                            };
                        } catch {
                            return {
                                name: entry.name,
                                type: entry.isDirectory() ? "directory" : "file",
                            };
                        }
                    })
                );
                return NextResponse.json({ success: true, items, path: dirPath });
            }

            /* ─── Search Files (grep-like) ─── */
            case "search_files": {
                const dirPath = resolveSafe(args.path || ".", args.workspace);
                const pattern = args.pattern;
                const results: Array<{ file: string; line: number; content: string }> = [];

                const searchDir = async (dir: string) => {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
                        if (entry.isDirectory()) {
                            await searchDir(fullPath);
                        } else if (entry.isFile()) {
                            try {
                                const content = await fs.readFile(fullPath, "utf-8");
                                const lines = content.split("\n");
                                for (let i = 0; i < lines.length; i++) {
                                    if (lines[i].includes(pattern)) {
                                        results.push({
                                            file: path.relative(args.workspace || DEFAULT_WORKSPACE, fullPath),
                                            line: i + 1,
                                            content: lines[i].trim().slice(0, 200),
                                        });
                                        if (results.length >= 50) return;
                                    }
                                }
                            } catch { /* skip binary files */ }
                        }
                    }
                };

                await searchDir(dirPath);
                return NextResponse.json({ success: true, results, total: results.length });
            }

            /* ─── Run Terminal Command ─── */
            case "run_command": {
                const cwd = args.cwd
                    ? resolveSafe(args.cwd, args.workspace)
                    : (args.workspace || DEFAULT_WORKSPACE);

                const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
                    const child = exec(args.command, {
                        cwd,
                        timeout: 60000,
                        maxBuffer: 1024 * 1024 * 5, // 5MB
                        env: { ...process.env, FORCE_COLOR: "0" },
                    }, (error, stdout, stderr) => {
                        resolve({
                            stdout: stdout?.slice(-5000) || "", // Last 5K chars
                            stderr: stderr?.slice(-2000) || "",
                            exitCode: error?.code || (child.exitCode ?? 0),
                        });
                    });
                });

                return NextResponse.json({
                    success: result.exitCode === 0,
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: result.exitCode,
                    command: args.command,
                });
            }

            /* ─── Create Project ─── */
            case "create_project": {
                const projectPath = resolveSafe(args.name || "new-project", args.workspace);
                await fs.mkdir(projectPath, { recursive: true });

                // Template-based scaffolding
                const template = args.template || "react";
                const files: Record<string, string> = {};

                if (template === "react" || template === "vite-react") {
                    files["package.json"] = JSON.stringify({
                        name: args.name || "new-project",
                        private: true,
                        version: "0.0.0",
                        type: "module",
                        scripts: {
                            dev: "vite",
                            build: "vite build",
                            preview: "vite preview",
                        },
                        dependencies: {
                            react: "^18.3.0",
                            "react-dom": "^18.3.0",
                        },
                        devDependencies: {
                            "@types/react": "^18.3.0",
                            "@types/react-dom": "^18.3.0",
                            "@vitejs/plugin-react": "^4.3.0",
                            typescript: "^5.5.0",
                            vite: "^5.4.0",
                        },
                    }, null, 2);

                    files["index.html"] = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${args.name || "App"}</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
</body>
</html>`;

                    files["src/main.tsx"] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);`;

                    files["src/App.tsx"] = `export default function App() {
    return (
        <div>
            <h1>Hello World</h1>
        </div>
    );
}`;

                    files["src/index.css"] = `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; }`;

                    files["tsconfig.json"] = JSON.stringify({
                        compilerOptions: {
                            target: "ES2020",
                            useDefineForClassFields: true,
                            lib: ["ES2020", "DOM", "DOM.Iterable"],
                            module: "ESNext",
                            skipLibCheck: true,
                            moduleResolution: "bundler",
                            jsx: "react-jsx",
                            strict: true,
                        },
                        include: ["src"],
                    }, null, 2);

                    files["vite.config.ts"] = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
});`;
                }

                // Write all files
                for (const [filePath, content] of Object.entries(files)) {
                    const fullPath = path.join(projectPath, filePath);
                    await fs.mkdir(path.dirname(fullPath), { recursive: true });
                    await fs.writeFile(fullPath, content, "utf-8");
                }

                return NextResponse.json({
                    success: true,
                    message: `Created ${template} project at ${args.name}`,
                    path: projectPath,
                    files: Object.keys(files),
                });
            }

            /* ═══════════════════════════════════════════
               PROJECT INTELLIGENCE TOOLS
               ═══════════════════════════════════════════ */

            /* ─── Scan Project ─── */
            case "scan_project": {
                const workspace = args.workspace || DEFAULT_WORKSPACE;
                const snapshot = await scanFullProject(workspace);
                // Cache the snapshot for subsequent tool calls
                (globalThis as Record<string, unknown>).__projectSnapshot = snapshot;
                const compressed = compressProjectContext(snapshot);
                return NextResponse.json({
                    success: true,
                    context: compressed,
                    stats: snapshot.stats,
                    conventions: snapshot.conventions,
                    packageJson: snapshot.packageJson,
                });
            }

            /* ─── Find Symbol ─── */
            case "find_symbol": {
                const snapshot = (globalThis as Record<string, unknown>).__projectSnapshot as ProjectSnapshot | undefined;
                if (!snapshot) {
                    return NextResponse.json({
                        success: false,
                        error: "No project scan available. Call scan_project first.",
                    });
                }
                const results = findSymbol(snapshot, args.query as string);
                return NextResponse.json({
                    success: true,
                    query: args.query,
                    results: results.slice(0, 30),
                    total: results.length,
                });
            }

            /* ─── Check Imports ─── */
            case "check_imports": {
                const filePath = args.path as string;
                const workspace = args.workspace || DEFAULT_WORKSPACE;

                // Try cached snapshot first
                let snapshot = (globalThis as Record<string, unknown>).__projectSnapshot as ProjectSnapshot | undefined;

                // If no cached snapshot but we have a file path, extract directly
                if (!snapshot && filePath) {
                    const fullPath = path.resolve(workspace, filePath);
                    const [symbols, imports] = await Promise.all([
                        extractSymbols(fullPath, filePath),
                        extractImports(fullPath, filePath),
                    ]);
                    return NextResponse.json({
                        success: true,
                        file: filePath,
                        exports: symbols,
                        imports: imports,
                        dependents: [],
                    });
                }

                if (snapshot) {
                    const fileImports = snapshot.imports.filter(i => i.from === filePath);
                    const fileExports = snapshot.symbols.filter(s => s.file === filePath);
                    const dependents = findDependents(snapshot, filePath);

                    return NextResponse.json({
                        success: true,
                        file: filePath,
                        exports: fileExports,
                        imports: fileImports,
                        dependents,
                    });
                }

                return NextResponse.json({
                    success: false,
                    error: "No project scan available and no file path provided. Call scan_project first.",
                });
            }

            /* ─── Analyze Architecture ─── */
            case "analyze_architecture": {
                const workspace = args.workspace || DEFAULT_WORKSPACE;
                let snapshot = (globalThis as Record<string, unknown>).__projectSnapshot as ProjectSnapshot | undefined;

                // Auto-scan if no cached snapshot
                if (!snapshot) {
                    snapshot = await scanFullProject(workspace);
                    (globalThis as Record<string, unknown>).__projectSnapshot = snapshot;
                }

                const compressed = compressProjectContext(snapshot);

                // Build a high-level architecture summary
                const archLines: string[] = [];
                archLines.push(`# Architecture Analysis`);
                archLines.push(`\n${compressed}`);

                // Add dependency hotspots (most imported files)
                const importCounts = new Map<string, number>();
                for (const imp of snapshot.imports.filter(i => !i.isExternal)) {
                    const count = importCounts.get(imp.to) || 0;
                    importCounts.set(imp.to, count + 1);
                }

                const hotspots = Array.from(importCounts.entries())
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10);

                if (hotspots.length > 0) {
                    archLines.push(`\n### Dependency Hotspots (most imported)`);
                    for (const [file, count] of hotspots) {
                        archLines.push(`  ${file}: imported by ${count} files`);
                    }
                }

                // Add file exists check helper info
                archLines.push(`\n### Pre-flight Reminder`);
                archLines.push(`Before creating a file, check if it already exists in the tree above.`);
                archLines.push(`Before using a variable/function, check the Exported Symbols list above.`);
                archLines.push(`Before editing a file, check who imports it via Internal Dependencies.`);

                return NextResponse.json({
                    success: true,
                    architecture: archLines.join("\n"),
                    stats: snapshot.stats,
                });
            }

            /* ═══════════════════════════════════════════
               AUTONOMOUS INTELLIGENCE TOOLS
               ═══════════════════════════════════════════ */

            /* ── Detect Environment ── */
            case "detect_environment": {
                const env = await detectEnvironment();
                return NextResponse.json({
                    success: true,
                    output: env.summary,
                    tools: env.tools,
                    availablePorts: env.availablePorts,
                    ollamaRunning: env.ollamaRunning,
                });
            }

            /* ── Start Services ── */
            case "start_services": {
                const workspace = args.workspace || DEFAULT_WORKSPACE;
                let serviceIds: string[];
                const servicesArg = args.services as string | undefined;

                if (servicesArg) {
                    serviceIds = servicesArg.split(",").map((s: string) => s.trim());
                } else {
                    // Auto-detect from package.json
                    try {
                        const pkgPath = path.resolve(workspace, "package.json");
                        const pkgContent = await fs.readFile(pkgPath, "utf-8");
                        const pkg = JSON.parse(pkgContent);
                        const allDeps = [
                            ...Object.keys(pkg.dependencies || {}),
                            ...Object.keys(pkg.devDependencies || {}),
                        ];
                        serviceIds = detectRequiredServices(allDeps);
                    } catch {
                        serviceIds = [];
                    }
                }

                if (serviceIds.length === 0) {
                    return NextResponse.json({
                        success: true,
                        output: "No infrastructure services required for this project.",
                        portAssignments: {},
                    });
                }

                const plan = await planInfrastructure(serviceIds);
                const envFile = generateEnvFile(plan.portAssignments);

                return NextResponse.json({
                    success: true,
                    output: `🏗️ Infrastructure Plan:\n${plan.summary}\n\n📋 Docker Compose generated\n\n📝 .env connection strings:\n${envFile}\n\nTo start: Run \`docker compose -f docker-compose.infrastructure.yml up -d\``,
                    portAssignments: plan.portAssignments,
                    dockerCompose: plan.dockerCompose,
                });
            }

            /* ── Health Check ── */
            case "health_check": {
                const portAssignments = args.portAssignments as Record<string, number> | undefined;
                if (!portAssignments || Object.keys(portAssignments).length === 0) {
                    return NextResponse.json({
                        success: true,
                        output: "No infrastructure services are being tracked. Call start_services first.",
                    });
                }
                const statuses = await healthCheckServices(portAssignments);
                const statusText = statuses.map(s => {
                    const icon = s.status === "running" ? "✅" : s.status === "starting" ? "⏳" : "❌";
                    return `${icon} ${s.name}: ${s.status} (port ${s.port})`;
                }).join("\n");
                return NextResponse.json({
                    success: true,
                    output: `🏥 Service Health:\n${statusText}`,
                });
            }

            /* ── Self Assess ── */
            case "self_assess": {
                const workspace = args.workspace || DEFAULT_WORKSPACE;
                const memory = await loadLearningMemory(workspace);
                const gaps = detectSkillGaps("");
                const report = getIntelligenceReport(gaps.coverageScore, memory);
                return NextResponse.json({
                    success: true,
                    output: `🧠 Intelligence Report:\n\n${report.selfAssessment}\n\n📊 Metrics:\n- Skill Coverage: ${Math.round(report.skillCoverage * 100)}%\n- Task Success Rate: ${report.taskSuccessRate}%\n- Build Pass Rate: ${report.buildPassRate}%\n- Total Tool Calls: ${report.totalToolCalls}\n- Total Errors: ${report.totalErrors}\n\n🔻 Known Weaknesses: ${report.knownWeaknesses.join(", ") || "None"}\n📚 Recent Learnings: ${report.recentLearnings.join(", ") || "None"}`,
                });
            }

            default:
                return NextResponse.json({ success: false, error: `Unknown tool: ${tool}` }, { status: 400 });
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Tool execution failed";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
