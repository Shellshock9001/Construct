/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — Real-time Documentation Research
   
   Powered by Tavily search API. The agent can research official docs,
   validate API signatures, and discover best practices during a task.
   Results are cached to avoid redundant searches.
   ═══════════════════════════════════════════════════════════════════ */

import { searchTavily, type TavilySearchResult } from './providers';

/* ─── Types ─── */

export interface DocSearchResult {
    query: string;
    summary: string;
    sources: Array<{
        title: string;
        url: string;
        snippet: string;
        relevance: number;
    }>;
    cachedAt: number;
}

/* ─── In-Memory Cache ─── */

const docCache = new Map<string, DocSearchResult>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Normalize a query for cache key matching
 */
function normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check the cache for a previous result
 */
function getCached(query: string): DocSearchResult | null {
    const key = normalizeQuery(query);
    const cached = docCache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
        return cached;
    }
    // Also check localStorage for persistence across page reloads
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem(`ssh_doc_${key}`);
            if (stored) {
                const parsed: DocSearchResult = JSON.parse(stored);
                if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
                    docCache.set(key, parsed);
                    return parsed;
                }
            }
        } catch { /* ignore parse errors */ }
    }
    return null;
}

/**
 * Store a result in cache (memory + localStorage)
 */
function setCache(query: string, result: DocSearchResult): void {
    const key = normalizeQuery(query);
    docCache.set(key, result);
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(`ssh_doc_${key}`, JSON.stringify(result));
        } catch { /* storage full — ignore */ }
    }
}

/* ═══════════════════════════════════════════
   DOCUMENTATION SEARCH
   ═══════════════════════════════════════════ */

/**
 * Search for documentation on a specific topic.
 * Automatically targets official docs and high-quality sources.
 */
export async function researchDocs(
    topic: string,
    options?: {
        framework?: string;
        depth?: 'basic' | 'advanced';
        maxResults?: number;
    }
): Promise<DocSearchResult> {
    // Check cache first
    const cached = getCached(topic);
    if (cached) {
        return { ...cached, summary: `[CACHED] ${cached.summary}` };
    }

    // Build a search query targeting official docs
    const framework = options?.framework || '';
    const searchQuery = framework
        ? `${topic} ${framework} official documentation site:${getDocsDomain(framework)}`
        : `${topic} official documentation best practices`;

    const tavilyResult = await searchTavily(searchQuery, {
        depth: options?.depth || 'advanced',
        maxResults: options?.maxResults || 5,
    });

    if (!tavilyResult) {
        return {
            query: topic,
            summary: `Could not find documentation for "${topic}". Try rephrasing or check your Tavily API key.`,
            sources: [],
            cachedAt: Date.now(),
        };
    }

    const result: DocSearchResult = {
        query: topic,
        summary: tavilyResult.answer || `Found ${tavilyResult.sources.length} sources for "${topic}"`,
        sources: tavilyResult.sources.map(s => ({
            title: s.title,
            url: s.url,
            snippet: s.snippet,
            relevance: s.score,
        })),
        cachedAt: Date.now(),
    };

    // Cache the result
    setCache(topic, result);

    return result;
}

/**
 * Research and validate a specific API or package
 */
export async function validateAPI(
    packageName: string,
    apiCall: string,
): Promise<string> {
    const result = await researchDocs(
        `${packageName} ${apiCall} API usage examples`,
        { depth: 'advanced', maxResults: 3 }
    );

    if (result.sources.length === 0) {
        return `⚠️ Could not validate "${apiCall}" from "${packageName}". The API may not exist — consider using web_search to verify.`;
    }

    const snippets = result.sources
        .map(s => `- [${s.title}](${s.url}): ${s.snippet}`)
        .join('\n');

    return `✓ Found documentation for ${packageName}.${apiCall}:\n${result.summary}\n\nSources:\n${snippets}`;
}

/**
 * Get the docs domain for a framework (for targeted search)
 */
function getDocsDomain(framework: string): string {
    const domains: Record<string, string> = {
        react: 'react.dev',
        nextjs: 'nextjs.org',
        next: 'nextjs.org',
        vue: 'vuejs.org',
        angular: 'angular.dev',
        express: 'expressjs.com',
        fastapi: 'fastapi.tiangolo.com',
        prisma: 'prisma.io',
        tailwind: 'tailwindcss.com',
        typescript: 'typescriptlang.org',
        node: 'nodejs.org',
        python: 'docs.python.org',
        docker: 'docs.docker.com',
        vite: 'vite.dev',
        postgres: 'postgresql.org',
        shadcn: 'ui.shadcn.com',
        zod: 'zod.dev',
        drizzle: 'orm.drizzle.team',
    };

    const lower = framework.toLowerCase();
    for (const [key, domain] of Object.entries(domains)) {
        if (lower.includes(key)) return domain;
    }
    return '';
}

/**
 * Format a doc search result for injection into the agent's context
 */
export function formatDocResult(result: DocSearchResult): string {
    if (result.sources.length === 0) {
        return `No documentation found for: ${result.query}`;
    }

    const sourceList = result.sources
        .slice(0, 5)
        .map((s, i) => `${i + 1}. [${s.title}](${s.url})\n   ${s.snippet}`)
        .join('\n\n');

    return `## Documentation: ${result.query}

${result.summary}

### Sources
${sourceList}`;
}
