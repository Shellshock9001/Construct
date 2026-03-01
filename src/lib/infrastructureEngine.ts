/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Infrastructure Engine
   
   Intelligent environment management. The agent scans for available
   ports, detects installed tools, auto-starts required services
   (databases, caches, queues), generates Docker Compose configs,
   and performs health checks — all autonomously.
   ═══════════════════════════════════════════════════════════════════ */

import { exec } from "child_process";
import { promisify } from "util";
import net from "net";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

/* ─── Types ─── */

export interface EnvironmentReport {
    /** Detected tools and their versions */
    tools: Record<string, string | null>;
    /** Available ports (tested, not in use) */
    availablePorts: number[];
    /** Currently occupied ports with process info */
    occupiedPorts: PortInfo[];
    /** Whether Ollama LLM is running */
    ollamaRunning: boolean;
    /** OS platform */
    platform: string;
    /** Summary for the agent */
    summary: string;
}

export interface PortInfo {
    port: number;
    process?: string;
    pid?: number;
}

export interface ServiceConfig {
    name: string;
    image?: string;
    port: number;
    healthCheck: string;
    env?: Record<string, string>;
    volumes?: string[];
    command?: string;
}

export interface ServiceStatus {
    name: string;
    status: "running" | "starting" | "stopped" | "error";
    port: number;
    pid?: number;
    healthEndpoint?: string;
    error?: string;
}

export interface InfrastructurePlan {
    /** Services that need to be started */
    services: ServiceConfig[];
    /** Generated docker-compose content */
    dockerCompose: string;
    /** Port assignments (service → port) */
    portAssignments: Record<string, number>;
    /** Summary for the agent */
    summary: string;
}

/* ═══════════════════════════════════════════
   PORT SCANNER — Find available ports, prevent collisions
   ═══════════════════════════════════════════ */

/**
 * Check if a specific port is available.
 */
export function isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close(() => resolve(true));
        });
        server.listen(port, "127.0.0.1");
    });
}

/**
 * Find N available ports starting from a given port.
 * Skips commonly used system ports and ensures no collisions.
 */
export async function findAvailablePorts(
    count: number,
    startFrom: number = 3000,
): Promise<number[]> {
    const available: number[] = [];
    const maxPort = 9999;
    let current = startFrom;

    // Skip known problematic ports
    const skipPorts = new Set([
        3306, 5432, 6379, 8080, 8443, 11434, // commonly pre-occupied
    ]);

    while (available.length < count && current <= maxPort) {
        if (!skipPorts.has(current)) {
            const free = await isPortAvailable(current);
            if (free) {
                available.push(current);
            }
        }
        current++;
    }

    return available;
}

/**
 * Find a single available port near a preferred port.
 * Tries preferred first, then scans nearby.
 */
export async function findPortNear(preferred: number): Promise<number> {
    // Try the preferred port first
    if (await isPortAvailable(preferred)) return preferred;

    // Scan nearby (+1 to +50)
    for (let offset = 1; offset <= 50; offset++) {
        const port = preferred + offset;
        if (port <= 65535 && await isPortAvailable(port)) {
            return port;
        }
    }

    // Fallback: find any available port in high range
    const [port] = await findAvailablePorts(1, 9000);
    return port || 0;
}

/**
 * Get currently occupied ports on Windows.
 */
async function getOccupiedPorts(): Promise<PortInfo[]> {
    try {
        const { stdout } = await execAsync("netstat -ano -p tcp", { timeout: 5000 });
        const lines = stdout.split("\n").filter(l => l.includes("LISTENING"));
        const ports: PortInfo[] = [];

        for (const line of lines) {
            const match = line.match(/:(\d+)\s+.*?LISTENING\s+(\d+)/);
            if (match) {
                const port = parseInt(match[1]);
                const pid = parseInt(match[2]);
                if (port >= 1024 && port <= 65535) {
                    ports.push({ port, pid });
                }
            }
        }

        return ports;
    } catch {
        return [];
    }
}

/* ═══════════════════════════════════════════
   ENVIRONMENT DETECTOR — What's installed?
   ═══════════════════════════════════════════ */

/**
 * Detect the full development environment.
 */
export async function detectEnvironment(): Promise<EnvironmentReport> {
    // Check all tools in parallel
    const [
        nodeVer, npmVer, pythonVer, dockerVer,
        gitVer, ollamaVer, rustVer, goVer,
        occupiedPorts, availPorts,
    ] = await Promise.all([
        getToolVersion("node --version"),
        getToolVersion("npm --version"),
        getToolVersion("python --version").then(v =>
            v || getToolVersion("python3 --version")
        ),
        getToolVersion("docker --version"),
        getToolVersion("git --version"),
        checkOllama(),
        getToolVersion("rustc --version"),
        getToolVersion("go version"),
        getOccupiedPorts(),
        findAvailablePorts(10, 3000),
    ]);

    const tools: Record<string, string | null> = {
        node: nodeVer,
        npm: npmVer,
        python: pythonVer as string | null,
        docker: dockerVer,
        git: gitVer,
        ollama: ollamaVer ? "running" : null,
        rust: rustVer,
        go: goVer,
    };

    const ollamaRunning = !!ollamaVer;

    // Build summary
    const installed = Object.entries(tools)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

    const missing = Object.entries(tools)
        .filter(([, v]) => v === null)
        .map(([k]) => k)
        .join(", ");

    const summary = `Environment Report:
Installed: ${installed || "none detected"}
Not found: ${missing || "all tools present"}
Available ports: ${availPorts.join(", ")}
Occupied ports: ${occupiedPorts.length} ports in use
Ollama LLM: ${ollamaRunning ? "✅ running" : "❌ not running"}
Platform: win32`;

    return {
        tools,
        availablePorts: availPorts,
        occupiedPorts,
        ollamaRunning,
        platform: "win32",
        summary,
    };
}

/** Get a tool's version by running a command */
async function getToolVersion(command: string): Promise<string | null> {
    try {
        const { stdout } = await execAsync(command, { timeout: 5000 });
        return stdout.trim().replace(/^v/, "").split("\n")[0].trim();
    } catch {
        return null;
    }
}

/** Check if Ollama is running by pinging its API */
async function checkOllama(): Promise<string | null> {
    try {
        const { stdout } = await execAsync("curl -s http://localhost:11434/api/tags", { timeout: 3000 });
        if (stdout.includes("models")) return "running";
        return null;
    } catch {
        return null;
    }
}

/* ═══════════════════════════════════════════
   SERVICE MANAGER — Auto-start required services
   ═══════════════════════════════════════════ */

/** Well-known service configurations */
const SERVICE_TEMPLATES: Record<string, Omit<ServiceConfig, "port">> = {
    postgres: {
        name: "PostgreSQL",
        image: "postgres:16-alpine",
        healthCheck: "pg_isready -U postgres",
        env: {
            POSTGRES_USER: "postgres",
            POSTGRES_PASSWORD: "postgres",
            POSTGRES_DB: "app",
        },
        volumes: ["pgdata:/var/lib/postgresql/data"],
    },
    redis: {
        name: "Redis",
        image: "redis:7-alpine",
        healthCheck: "redis-cli ping",
        command: "redis-server --save 60 1 --loglevel warning",
    },
    mongodb: {
        name: "MongoDB",
        image: "mongo:7",
        healthCheck: "mongosh --eval 'db.adminCommand(\"ping\")'",
        env: {
            MONGO_INITDB_ROOT_USERNAME: "admin",
            MONGO_INITDB_ROOT_PASSWORD: "admin",
        },
        volumes: ["mongodata:/data/db"],
    },
    rabbitmq: {
        name: "RabbitMQ",
        image: "rabbitmq:3-management-alpine",
        healthCheck: "rabbitmq-diagnostics -q check_running",
        env: {
            RABBITMQ_DEFAULT_USER: "admin",
            RABBITMQ_DEFAULT_PASS: "admin",
        },
    },
    nats: {
        name: "NATS",
        image: "nats:latest",
        healthCheck: "wget --spider http://localhost:8222/healthz",
        command: "--jetstream",
    },
    minio: {
        name: "MinIO (S3-compatible)",
        image: "minio/minio:latest",
        healthCheck: "curl -f http://localhost:9000/minio/health/live",
        env: {
            MINIO_ROOT_USER: "minioadmin",
            MINIO_ROOT_PASSWORD: "minioadmin",
        },
        command: "server /data --console-address ':9001'",
        volumes: ["miniodata:/data"],
    },
};

/** Default ports for services */
const DEFAULT_PORTS: Record<string, number> = {
    postgres: 5432,
    redis: 6379,
    mongodb: 27017,
    rabbitmq: 5672,
    nats: 4222,
    minio: 9000,
};

/**
 * Detect which services a project needs based on its dependencies.
 */
export function detectRequiredServices(packageDeps: string[]): string[] {
    const services: string[] = [];

    const depString = packageDeps.join(" ").toLowerCase();

    if (depString.includes("prisma") || depString.includes("pg") || depString.includes("postgres") || depString.includes("typeorm") || depString.includes("knex") || depString.includes("sequelize")) {
        services.push("postgres");
    }
    if (depString.includes("redis") || depString.includes("ioredis") || depString.includes("bullmq") || depString.includes("bull")) {
        services.push("redis");
    }
    if (depString.includes("mongoose") || depString.includes("mongodb") || depString.includes("mongo")) {
        services.push("mongodb");
    }
    if (depString.includes("amqplib") || depString.includes("rabbitmq") || depString.includes("amqp")) {
        services.push("rabbitmq");
    }
    if (depString.includes("nats") || depString.includes("@nats-io")) {
        services.push("nats");
    }
    if (depString.includes("minio") || depString.includes("@aws-sdk/client-s3")) {
        services.push("minio");
    }

    return services;
}

/**
 * Build an infrastructure plan: what to start, which ports, docker-compose.
 */
export async function planInfrastructure(
    requiredServices: string[],
): Promise<InfrastructurePlan> {
    if (requiredServices.length === 0) {
        return {
            services: [],
            dockerCompose: "",
            portAssignments: {},
            summary: "No additional infrastructure required.",
        };
    }

    // Assign ports (find available ones near defaults)
    const portAssignments: Record<string, number> = {};
    const services: ServiceConfig[] = [];

    for (const svcId of requiredServices) {
        const template = SERVICE_TEMPLATES[svcId];
        if (!template) continue;

        const defaultPort = DEFAULT_PORTS[svcId] || 3000;
        const assignedPort = await findPortNear(defaultPort);

        portAssignments[svcId] = assignedPort;
        services.push({ ...template, port: assignedPort });
    }

    // Generate docker-compose.yml
    const dockerCompose = generateDockerCompose(services, portAssignments, requiredServices);

    const summary = services.map(s =>
        `${s.name}: port ${s.port} (image: ${s.image})`
    ).join("\n");

    return {
        services,
        dockerCompose,
        portAssignments,
        summary: `Infrastructure Plan:\n${summary}\n\nAll ports verified as available. Docker Compose generated.`,
    };
}

/**
 * Generate docker-compose.yml content.
 */
function generateDockerCompose(
    services: ServiceConfig[],
    portAssignments: Record<string, number>,
    serviceIds: string[],
): string {
    const svcBlocks = services.map((svc, i) => {
        const id = serviceIds[i];
        const port = portAssignments[id];
        const defaultPort = DEFAULT_PORTS[id] || port;

        let block = `  ${id}:\n    image: ${svc.image}\n    container_name: shellshock_${id}`;
        block += `\n    ports:\n      - "${port}:${defaultPort}"`;

        if (svc.env) {
            block += "\n    environment:";
            for (const [key, val] of Object.entries(svc.env)) {
                block += `\n      - ${key}=${val}`;
            }
        }

        if (svc.command) {
            block += `\n    command: ${svc.command}`;
        }

        if (svc.volumes) {
            block += "\n    volumes:";
            for (const vol of svc.volumes) {
                block += `\n      - ${vol}`;
            }
        }

        block += `\n    healthcheck:\n      test: ["CMD-SHELL", "${svc.healthCheck}"]\n      interval: 10s\n      timeout: 5s\n      retries: 5`;
        block += "\n    restart: unless-stopped";

        return block;
    });

    // Collect volumes
    const volumes = services
        .flatMap(s => s.volumes || [])
        .map(v => v.split(":")[0])
        .filter((v, i, arr) => arr.indexOf(v) === i);

    let compose = `# ShellShockHive — Auto-generated Infrastructure
# Generated: ${new Date().toISOString()}
# Ports verified as available at generation time

version: "3.8"

services:
${svcBlocks.join("\n\n")}`;

    if (volumes.length > 0) {
        compose += `\n\nvolumes:\n${volumes.map(v => `  ${v}:`).join("\n")}`;
    }

    return compose;
}

/* ═══════════════════════════════════════════
   HEALTH CHECKS — Verify services are running
   ═══════════════════════════════════════════ */

/**
 * Health check all running services.
 */
export async function healthCheckServices(
    portAssignments: Record<string, number>,
): Promise<ServiceStatus[]> {
    const statuses: ServiceStatus[] = [];

    for (const [svcId, port] of Object.entries(portAssignments)) {
        const template = SERVICE_TEMPLATES[svcId];
        const available = await isPortAvailable(port);

        if (available) {
            // Port is open = service NOT running (nothing is listening)
            statuses.push({
                name: template?.name || svcId,
                status: "stopped",
                port,
            });
        } else {
            // Port is occupied = something is listening
            statuses.push({
                name: template?.name || svcId,
                status: "running",
                port,
            });
        }
    }

    return statuses;
}

/**
 * Start infrastructure using Docker Compose.
 */
export async function startInfrastructure(
    workspace: string,
    dockerCompose: string,
): Promise<{ success: boolean; output: string; error?: string }> {
    try {
        // Write docker-compose file
        const composePath = path.join(workspace, "docker-compose.infrastructure.yml");
        await fs.writeFile(composePath, dockerCompose, "utf-8");

        // Start services
        const { stdout, stderr } = await execAsync(
            `docker compose -f "${composePath}" up -d`,
            { cwd: workspace, timeout: 60000 },
        );

        return {
            success: true,
            output: `Infrastructure started.\n\nDocker Compose output:\n${stdout}\n${stderr}`.trim(),
        };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            output: "",
            error: `Failed to start infrastructure: ${msg}`,
        };
    }
}

/**
 * Generate a .env file with service connection strings.
 */
export function generateEnvFile(portAssignments: Record<string, number>): string {
    const lines: string[] = [
        "# Auto-generated by ShellShockHive Infrastructure Engine",
        `# Generated: ${new Date().toISOString()}`,
        "",
    ];

    for (const [svcId, port] of Object.entries(portAssignments)) {
        switch (svcId) {
            case "postgres":
                lines.push(`DATABASE_URL="postgresql://postgres:postgres@localhost:${port}/app?schema=public"`);
                break;
            case "redis":
                lines.push(`REDIS_URL="redis://localhost:${port}"`);
                break;
            case "mongodb":
                lines.push(`MONGODB_URL="mongodb://admin:admin@localhost:${port}"`);
                break;
            case "rabbitmq":
                lines.push(`RABBITMQ_URL="amqp://admin:admin@localhost:${port}"`);
                break;
            case "nats":
                lines.push(`NATS_URL="nats://localhost:${port}"`);
                break;
            case "minio":
                lines.push(`S3_ENDPOINT="http://localhost:${port}"`);
                lines.push(`S3_ACCESS_KEY="minioadmin"`);
                lines.push(`S3_SECRET_KEY="minioadmin"`);
                break;
        }
    }

    return lines.join("\n") + "\n";
}
