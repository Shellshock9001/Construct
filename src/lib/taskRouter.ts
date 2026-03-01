/* ═══════════════════════════════════════════════════════════════════
   Construct — Task Router

   Routes different task types to preferred providers/models.
   Persisted in localStorage, editable from Settings.

   Task types:
   - code_gen:      Writing actual implementation code
   - research:      Researching libraries, APIs, patterns
   - validation:    Cross-validating generated code
   - architecture:  Blueprint decomposition, system design
   - general:       Default fallback for everything else
   ═══════════════════════════════════════════════════════════════════ */

import { type ProviderName, getProviderConfig, getSelectedModel } from './providers';

/* ─── Types ─── */

export type TaskType = 'code_gen' | 'research' | 'validation' | 'architecture' | 'general';

export interface RoutingRule {
    taskType: TaskType;
    preferProvider?: ProviderName;
    preferModel?: string;
    maxTokens?: number;
    temperature?: number;
    fallbackProviders: ProviderName[];
    enabled: boolean;
}

export interface RouterSettings {
    rules: RoutingRule[];
    parallelWorkers: {
        enabled: boolean;
        maxWorkers: number;
        researchDepth: 'basic' | 'advanced';
    };
    costControls: {
        maxTokensPerSession: number;
        preferFreeModels: boolean;
    };
}

/* ─── Storage ─── */

const STORAGE_KEY = 'construct_task_router';

const DEFAULT_SETTINGS: RouterSettings = {
    rules: [
        {
            taskType: 'code_gen',
            fallbackProviders: ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama'],
            temperature: 0.2,
            maxTokens: 4096,
            enabled: true,
        },
        {
            taskType: 'research',
            fallbackProviders: ['gemini', 'groq', 'openrouter', 'ollama'],
            temperature: 0.3,
            maxTokens: 2048,
            enabled: true,
        },
        {
            taskType: 'validation',
            fallbackProviders: ['gemini', 'groq', 'openrouter', 'ollama'],
            temperature: 0.1,
            maxTokens: 2048,
            enabled: true,
        },
        {
            taskType: 'architecture',
            fallbackProviders: ['anthropic', 'openai', 'gemini', 'openrouter'],
            temperature: 0.3,
            maxTokens: 3072,
            enabled: true,
        },
        {
            taskType: 'general',
            fallbackProviders: ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama'],
            temperature: 0.4,
            maxTokens: 4096,
            enabled: true,
        },
    ],
    parallelWorkers: {
        enabled: true,
        maxWorkers: 4,
        researchDepth: 'advanced',
    },
    costControls: {
        maxTokensPerSession: 500_000,
        preferFreeModels: false,
    },
};

/** Get current router settings (from localStorage or defaults) */
export function getRouterSettings(): RouterSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_SETTINGS;
        const parsed = JSON.parse(raw) as Partial<RouterSettings>;
        // Merge with defaults to handle schema changes
        return {
            rules: parsed.rules?.length ? parsed.rules : DEFAULT_SETTINGS.rules,
            parallelWorkers: { ...DEFAULT_SETTINGS.parallelWorkers, ...parsed.parallelWorkers },
            costControls: { ...DEFAULT_SETTINGS.costControls, ...parsed.costControls },
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

/** Save router settings */
export function saveRouterSettings(settings: RouterSettings): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Reset to defaults */
export function resetRouterSettings(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
}

/* ═══════════════════════════════════════════
   ROUTING LOGIC
   ═══════════════════════════════════════════ */

/**
 * Resolve the best provider for a given task type.
 * Checks user preferences, then falls through configured providers.
 */
export function resolveProvider(taskType: TaskType): {
    provider: ProviderName | null;
    model: string | null;
    temperature: number;
    maxTokens: number;
} {
    const settings = getRouterSettings();
    const rule = settings.rules.find(r => r.taskType === taskType && r.enabled)
        || settings.rules.find(r => r.taskType === 'general' && r.enabled);

    if (!rule) {
        return { provider: null, model: null, temperature: 0.3, maxTokens: 4096 };
    }

    // Check preferred provider first
    if (rule.preferProvider) {
        const config = getProviderConfig(rule.preferProvider);
        if (config.apiKey || rule.preferProvider === 'ollama') {
            return {
                provider: rule.preferProvider,
                model: rule.preferModel || getSelectedModel(rule.preferProvider),
                temperature: rule.temperature ?? 0.3,
                maxTokens: rule.maxTokens ?? 4096,
            };
        }
    }

    // Fall through configured providers
    for (const provider of rule.fallbackProviders) {
        const config = getProviderConfig(provider);
        if (config.apiKey || provider === 'ollama') {
            return {
                provider,
                model: getSelectedModel(provider),
                temperature: rule.temperature ?? 0.3,
                maxTokens: rule.maxTokens ?? 4096,
            };
        }
    }

    return { provider: null, model: null, temperature: 0.3, maxTokens: 4096 };
}

/**
 * Get the task type description for display.
 */
export function getTaskTypeLabel(type: TaskType): string {
    const labels: Record<TaskType, string> = {
        code_gen: 'Code Generation',
        research: 'Research & Analysis',
        validation: 'Cross-Validation',
        architecture: 'Architecture & Design',
        general: 'General Tasks',
    };
    return labels[type];
}

/**
 * Get the task type descriptions.
 */
export function getTaskTypeDescription(type: TaskType): string {
    const descriptions: Record<TaskType, string> = {
        code_gen: 'Creating and editing implementation files',
        research: 'Researching libraries, APIs, patterns via workers',
        validation: 'Cross-checking generated code with a second model',
        architecture: 'Blueprint decomposition and system design',
        general: 'Default for tasks that don\'t match other types',
    };
    return descriptions[type];
}
