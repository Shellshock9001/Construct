/* ═══════════════════════════════════════════════════════════════════
   ShellShockHive — AI Provider Abstraction Layer
   
   Unified interface for OpenAI, Anthropic, Ollama, Groq, OpenRouter,
   and Tavily. Each provider implements the same contract for chat,
   streaming, validation, and model discovery.
   ═══════════════════════════════════════════════════════════════════ */

/* ─── Types ─── */

export type ProviderName = 'openai' | 'anthropic' | 'ollama' | 'groq' | 'openrouter' | 'gemini' | 'tavily';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    model: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
}

export interface ChatResult {
    content: string;
    model: string;
    provider: ProviderName;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    error?: string;
}

export interface ModelInfo {
    id: string;
    name: string;
    description: string;
    contextWindow: number;
    tier: 'flagship' | 'fast' | 'reasoning' | 'budget' | 'local';
    provider: ProviderName;
}

export interface ProviderStatus {
    available: boolean;
    detail: string;
    status: 'valid' | 'invalid' | 'no_key' | 'checking' | 'error';
    models?: ModelInfo[];
}

export interface ProviderConfig {
    apiKey: string;
    baseUrl?: string;
    enabled: boolean;
}

/* ─── Storage ─── */

const STORAGE_PREFIX = 'ssh_';

export function getProviderConfig(provider: ProviderName): ProviderConfig {
    if (typeof window === 'undefined') {
        return { apiKey: '', enabled: false };
    }
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${provider}_config`);
        if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return {
        apiKey: '',
        baseUrl: provider === 'ollama' ? 'http://localhost:11434' : undefined,
        enabled: false,
    };
}

export function setProviderConfig(provider: ProviderName, config: Partial<ProviderConfig>): void {
    const current = getProviderConfig(provider);
    const updated = { ...current, ...config };
    localStorage.setItem(`${STORAGE_PREFIX}${provider}_config`, JSON.stringify(updated));
}

export function getSelectedModel(provider: ProviderName): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`${STORAGE_PREFIX}${provider}_model`) || getDefaultModel(provider);
}

export function setSelectedModel(provider: ProviderName, model: string): void {
    localStorage.setItem(`${STORAGE_PREFIX}${provider}_model`, model);
}

function getDefaultModel(provider: ProviderName): string {
    switch (provider) {
        case 'openai': return 'gpt-4o';
        case 'anthropic': return 'claude-sonnet-4-20250514';
        case 'ollama': return 'llama3.3';
        case 'groq': return 'llama-3.3-70b-versatile';
        case 'openrouter': return 'deepseek/deepseek-chat-v3-0324:free';
        case 'gemini': return 'gemini-2.5-flash';
        case 'tavily': return '';
    }
}

/* ═══════════════════════════════════════════
   MODEL CATALOGS — Latest Feb 2026
   ═══════════════════════════════════════════ */

export const OPENAI_MODELS: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable multimodal flagship', contextWindow: 128000, tier: 'flagship', provider: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and cost-effective', contextWindow: 128000, tier: 'fast', provider: 'openai' },
    { id: 'o1', name: 'o1', description: 'Advanced reasoning model', contextWindow: 200000, tier: 'reasoning', provider: 'openai' },
    { id: 'o1-mini', name: 'o1 Mini', description: 'Fast reasoning', contextWindow: 128000, tier: 'reasoning', provider: 'openai' },
    { id: 'o3-mini', name: 'o3 Mini', description: 'Latest compact reasoning', contextWindow: 200000, tier: 'reasoning', provider: 'openai' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Previous generation flagship', contextWindow: 128000, tier: 'flagship', provider: 'openai' },
];

export const ANTHROPIC_MODELS: ModelInfo[] = [
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best coding & reasoning model', contextWindow: 200000, tier: 'flagship', provider: 'anthropic' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'High-performance balanced model', contextWindow: 200000, tier: 'flagship', provider: 'anthropic' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient', contextWindow: 200000, tier: 'fast', provider: 'anthropic' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Maximum capability previous gen', contextWindow: 200000, tier: 'flagship', provider: 'anthropic' },
];

export const OLLAMA_MODEL_PRIORITIES = [
    'llama3.3', 'llama3.3:70b', 'llama3.2', 'llama3.1:70b', 'llama3.1',
    'qwen2.5-coder', 'qwen2.5', 'codellama', 'deepseek-coder-v2',
    'mistral', 'mixtral', 'gemma2', 'phi3',
];

export const GROQ_MODELS: ModelInfo[] = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Fast versatile coding model', contextWindow: 128000, tier: 'flagship', provider: 'groq' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 70B', description: 'Advanced reasoning model', contextWindow: 128000, tier: 'reasoning', provider: 'groq' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Ultra-fast budget model', contextWindow: 128000, tier: 'budget', provider: 'groq' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'MoE model with 32K context', contextWindow: 32768, tier: 'fast', provider: 'groq' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google compact model', contextWindow: 8192, tier: 'budget', provider: 'groq' },
];

export const OPENROUTER_MODELS: ModelInfo[] = [
    { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', description: 'Top-tier free coding model', contextWindow: 128000, tier: 'flagship', provider: 'openrouter' },
    { id: 'qwen/qwen3-coder-480b-a35b:free', name: 'Qwen3 Coder 480B', description: 'MoE coding specialist', contextWindow: 128000, tier: 'flagship', provider: 'openrouter' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', description: 'Meta flagship free model', contextWindow: 128000, tier: 'flagship', provider: 'openrouter' },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', description: 'Advanced reasoning (free)', contextWindow: 128000, tier: 'reasoning', provider: 'openrouter' },
    { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', description: 'Google mid-tier free', contextWindow: 96000, tier: 'fast', provider: 'openrouter' },
];

export const GEMINI_MODELS: ModelInfo[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast multimodal with thinking', contextWindow: 1048576, tier: 'fast', provider: 'gemini' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Best reasoning and coding', contextWindow: 1048576, tier: 'flagship', provider: 'gemini' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous gen fast model', contextWindow: 1048576, tier: 'fast', provider: 'gemini' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: 'Ultra-fast budget model', contextWindow: 1048576, tier: 'budget', provider: 'gemini' },
];

/* ═══════════════════════════════════════════
   PROVIDER IMPLEMENTATIONS
   ═══════════════════════════════════════════ */

/* ─── OpenAI ─── */

export async function chatOpenAI(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const config = getProviderConfig('openai');
    if (!config.apiKey) {
        return { content: '', model: options.model, provider: 'openai', error: 'No API key configured' };
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
                top_p: options.topP ?? 1,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { content: '', model: options.model, provider: 'openai', error: err?.error?.message || `HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || options.model,
            provider: 'openai',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
            } : undefined,
        };
    } catch (err: any) {
        return { content: '', model: options.model, provider: 'openai', error: err?.message || 'Request failed' };
    }
}

export async function streamOpenAI(
    messages: ChatMessage[],
    options: ChatOptions,
    onToken: (token: string) => void,
    onDone: (result: ChatResult) => void,
    onError: (error: string) => void,
): Promise<void> {
    const config = getProviderConfig('openai');
    if (!config.apiKey) {
        onError('No API key configured');
        return;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
                stream: true,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            onError(err?.error?.message || `HTTP ${response.status}`);
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        onToken(delta);
                    }
                } catch { /* skip malformed */ }
            }
        }

        onDone({ content: fullContent, model: options.model, provider: 'openai' });
    } catch (err: any) {
        onError(err?.message || 'Streaming failed');
    }
}

/* ─── Anthropic ─── */

export async function chatAnthropic(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const config = getProviderConfig('anthropic');
    if (!config.apiKey) {
        return { content: '', model: options.model, provider: 'anthropic', error: 'No API key configured' };
    }

    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');

    try {
        // Anthropic needs CORS proxy in browser — use our API route
        const response = await fetch('/api/anthropic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: config.apiKey,
                model: options.model,
                system: systemMsg,
                messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { content: '', model: options.model, provider: 'anthropic', error: err?.error || `HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
            content: data.content || '',
            model: data.model || options.model,
            provider: 'anthropic',
            usage: data.usage,
        };
    } catch (err: any) {
        return { content: '', model: options.model, provider: 'anthropic', error: err?.message || 'Request failed' };
    }
}

export async function streamAnthropic(
    messages: ChatMessage[],
    options: ChatOptions,
    onToken: (token: string) => void,
    onDone: (result: ChatResult) => void,
    onError: (error: string) => void,
): Promise<void> {
    const config = getProviderConfig('anthropic');
    if (!config.apiKey) { onError('No API key configured'); return; }

    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const userMsgs = messages.filter(m => m.role !== 'system');

    try {
        const response = await fetch('/api/anthropic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: config.apiKey,
                model: options.model,
                system: systemMsg,
                messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
                stream: true,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            onError(err?.error || `HTTP ${response.status}`);
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line.slice(6));
                    if (parsed.type === 'content_block_delta') {
                        const text = parsed.delta?.text;
                        if (text) {
                            fullContent += text;
                            onToken(text);
                        }
                    }
                } catch { /* skip */ }
            }
        }

        onDone({ content: fullContent, model: options.model, provider: 'anthropic' });
    } catch (err: any) {
        onError(err?.message || 'Streaming failed');
    }
}

/* ─── Ollama (FIXED: now uses /api/chat for proper multi-turn) ─── */

export async function chatOllama(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const config = getProviderConfig('ollama');
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    // Use /api/chat with proper message format for multi-turn conversation
    const ollamaMessages = messages.map(m => ({ role: m.role, content: m.content }));

    try {
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: options.model,
                messages: ollamaMessages,
                stream: false,
                options: {
                    temperature: options.temperature ?? 0.3,
                    num_predict: options.maxTokens ?? 4096,
                },
            }),
        });

        if (!response.ok) {
            return { content: '', model: options.model, provider: 'ollama', error: `Ollama HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
            content: data.message?.content || '',
            model: data.model || options.model,
            provider: 'ollama',
            usage: { inputTokens: data.prompt_eval_count || 0, outputTokens: data.eval_count || 0 },
        };
    } catch (err: any) {
        return { content: '', model: options.model, provider: 'ollama', error: err?.message || 'Ollama not running' };
    }
}

export async function streamOllama(
    messages: ChatMessage[],
    options: ChatOptions,
    onToken: (token: string) => void,
    onDone: (result: ChatResult) => void,
    onError: (error: string) => void,
): Promise<void> {
    const config = getProviderConfig('ollama');
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    // Use /api/chat with proper message format
    const ollamaMessages = messages.map(m => ({ role: m.role, content: m.content }));

    try {
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: options.model,
                messages: ollamaMessages,
                stream: true,
                options: {
                    temperature: options.temperature ?? 0.3,
                    num_predict: options.maxTokens ?? 4096,
                },
            }),
        });

        if (!response.ok) { onError(`Ollama HTTP ${response.status}`); return; }

        const reader = response.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    const content = parsed.message?.content;
                    if (content) {
                        fullContent += content;
                        onToken(content);
                    }
                } catch { /* skip */ }
            }
        }

        onDone({ content: fullContent, model: options.model, provider: 'ollama' });
    } catch (err: any) {
        onError(err?.message || 'Ollama streaming failed');
    }
}

export async function listOllamaModels(): Promise<ModelInfo[]> {
    const config = getProviderConfig('ollama');
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    try {
        const response = await fetch(`${baseUrl}/api/tags`);
        if (!response.ok) return [];
        const data = await response.json();

        return (data.models || []).map((m: any) => ({
            id: m.name,
            name: m.name.split(':')[0],
            description: `${(m.size / 1e9).toFixed(1)}GB · ${m.details?.parameter_size || 'unknown'}`,
            contextWindow: 0,
            tier: 'local' as const,
            provider: 'ollama' as const,
        }));
    } catch {
        return [];
    }
}

export async function pullOllamaModel(
    modelName: string,
    onProgress: (status: string, completed: number, total: number) => void,
): Promise<boolean> {
    const config = getProviderConfig('ollama');
    const baseUrl = config.baseUrl || 'http://localhost:11434';

    try {
        const response = await fetch(`${baseUrl}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: modelName, stream: true }),
        });

        if (!response.ok) return false;

        const reader = response.body?.getReader();
        if (!reader) return false;

        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line);
                    onProgress(
                        parsed.status || 'downloading',
                        parsed.completed || 0,
                        parsed.total || 0,
                    );
                } catch { /* skip */ }
            }
        }

        return true;
    } catch {
        return false;
    }
}

/* ─── Groq (OpenAI-compatible API, free tier) ─── */

export async function chatGroq(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const config = getProviderConfig('groq');
    if (!config.apiKey) {
        return { content: '', model: options.model, provider: 'groq', error: 'No Groq API key configured' };
    }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { content: '', model: options.model, provider: 'groq', error: err?.error?.message || `Groq HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || options.model,
            provider: 'groq',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
            } : undefined,
        };
    } catch (err: any) {
        return { content: '', model: options.model, provider: 'groq', error: err?.message || 'Groq request failed' };
    }
}

export async function streamGroq(
    messages: ChatMessage[],
    options: ChatOptions,
    onToken: (token: string) => void,
    onDone: (result: ChatResult) => void,
    onError: (error: string) => void,
): Promise<void> {
    const config = getProviderConfig('groq');
    if (!config.apiKey) { onError('No Groq API key configured'); return; }

    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: options.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
                stream: true,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            onError(err?.error?.message || `Groq HTTP ${response.status}`);
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        onToken(delta);
                    }
                } catch { /* skip malformed */ }
            }
        }

        onDone({ content: fullContent, model: options.model, provider: 'groq' });
    } catch (err: any) {
        onError(err?.message || 'Groq streaming failed');
    }
}

/* ─── OpenRouter (OpenAI-compatible API, free models available) ─── */

export async function chatOpenRouter(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const config = getProviderConfig('openrouter');
    if (!config.apiKey) {
        return { content: '', model: options.model, provider: 'openrouter', error: 'No OpenRouter API key configured' };
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3030',
                'X-Title': 'ShellShockHive',
            },
            body: JSON.stringify({
                model: options.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { content: '', model: options.model, provider: 'openrouter', error: err?.error?.message || `OpenRouter HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
            content: data.choices?.[0]?.message?.content || '',
            model: data.model || options.model,
            provider: 'openrouter',
            usage: data.usage ? {
                inputTokens: data.usage.prompt_tokens,
                outputTokens: data.usage.completion_tokens,
            } : undefined,
        };
    } catch (err: any) {
        return { content: '', model: options.model, provider: 'openrouter', error: err?.message || 'OpenRouter request failed' };
    }
}

export async function streamOpenRouter(
    messages: ChatMessage[],
    options: ChatOptions,
    onToken: (token: string) => void,
    onDone: (result: ChatResult) => void,
    onError: (error: string) => void,
): Promise<void> {
    const config = getProviderConfig('openrouter');
    if (!config.apiKey) { onError('No OpenRouter API key configured'); return; }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3030',
                'X-Title': 'ShellShockHive',
            },
            body: JSON.stringify({
                model: options.model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 4096,
                stream: true,
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            onError(err?.error?.message || `OpenRouter HTTP ${response.status}`);
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        onToken(delta);
                    }
                } catch { /* skip malformed */ }
            }
        }

        onDone({ content: fullContent, model: options.model, provider: 'openrouter' });
    } catch (err: any) {
        onError(err?.message || 'OpenRouter streaming failed');
    }
}

/* ─── Gemini (Google AI — REST API, NOT SDK) ─── */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

function toGeminiMessages(messages: ChatMessage[]): { system?: string; contents: any[] } {
    const systemMsg = messages.find(m => m.role === 'system')?.content;
    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));
    return { system: systemMsg, contents };
}

export async function chatGemini(messages: ChatMessage[], options: ChatOptions): Promise<ChatResult> {
    const config = getProviderConfig('gemini');
    if (!config.apiKey) {
        return { content: '', model: options.model, provider: 'gemini', error: 'No Gemini API key configured' };
    }

    const { system, contents } = toGeminiMessages(messages);

    try {
        const body: any = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.maxTokens ?? 4096,
            },
        };
        if (system) {
            body.systemInstruction = { parts: [{ text: system }] };
        }

        const response = await fetch(
            `${GEMINI_BASE}/models/${options.model}:generateContent?key=${config.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return { content: '', model: options.model, provider: 'gemini', error: err?.error?.message || `Gemini HTTP ${response.status}` };
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
        return {
            content: text,
            model: data.modelVersion || options.model,
            provider: 'gemini',
            usage: data.usageMetadata ? {
                inputTokens: data.usageMetadata.promptTokenCount || 0,
                outputTokens: data.usageMetadata.candidatesTokenCount || 0,
            } : undefined,
        };
    } catch (err: any) {
        return { content: '', model: options.model, provider: 'gemini', error: err?.message || 'Gemini request failed' };
    }
}

export async function streamGemini(
    messages: ChatMessage[],
    options: ChatOptions,
    onToken: (token: string) => void,
    onDone: (result: ChatResult) => void,
    onError: (error: string) => void,
): Promise<void> {
    const config = getProviderConfig('gemini');
    if (!config.apiKey) { onError('No Gemini API key configured'); return; }

    const { system, contents } = toGeminiMessages(messages);

    try {
        const body: any = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? 0.3,
                maxOutputTokens: options.maxTokens ?? 4096,
            },
        };
        if (system) {
            body.systemInstruction = { parts: [{ text: system }] };
        }

        const response = await fetch(
            `${GEMINI_BASE}/models/${options.model}:streamGenerateContent?alt=sse&key=${config.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            onError(err?.error?.message || `Gemini HTTP ${response.status}`);
            return;
        }

        const reader = response.body?.getReader();
        if (!reader) { onError('No response body'); return; }

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line.slice(6));
                    const text = parsed.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
                    if (text) {
                        fullContent += text;
                        onToken(text);
                    }
                } catch { /* skip malformed */ }
            }
        }

        onDone({ content: fullContent, model: options.model, provider: 'gemini' });
    } catch (err: any) {
        onError(err?.message || 'Gemini streaming failed');
    }
}

/** Dynamic model discovery — fetches available models from the Gemini API */
export async function listGeminiModels(): Promise<ModelInfo[]> {
    const config = getProviderConfig('gemini');
    if (!config.apiKey) return GEMINI_MODELS; // Fall back to hardcoded

    try {
        const response = await fetch(`${GEMINI_BASE}/models?key=${config.apiKey}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return GEMINI_MODELS;

        const data = await response.json();
        const models = (data.models || [])
            .filter((m: any) =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                m.name?.startsWith('models/gemini')
            )
            .map((m: any) => {
                const id = m.name.replace('models/', '');
                return {
                    id,
                    name: m.displayName || id,
                    description: (m.description || '').slice(0, 80),
                    contextWindow: m.inputTokenLimit || 0,
                    tier: id.includes('pro') ? 'flagship' as const
                        : id.includes('flash-lite') ? 'budget' as const
                            : id.includes('flash') ? 'fast' as const
                                : 'fast' as const,
                    provider: 'gemini' as const,
                };
            });

        return models.length > 0 ? models : GEMINI_MODELS;
    } catch {
        return GEMINI_MODELS;
    }
}

/* ─── Tavily ─── */

export interface TavilySearchResult {
    answer?: string;
    sources: Array<{ title: string; url: string; snippet: string; score: number }>;
}

export async function searchTavily(query: string, options?: { depth?: 'basic' | 'advanced'; maxResults?: number }): Promise<TavilySearchResult | null> {
    const config = getProviderConfig('tavily');
    if (!config.apiKey) return null;

    try {
        const response = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: config.apiKey,
                query,
                search_depth: options?.depth || 'basic',
                include_answer: true,
                include_raw_content: false,
                max_results: options?.maxResults || 5,
            }),
        });

        if (!response.ok) return null;
        const data = await response.json();

        return {
            answer: data.answer,
            sources: (data.results || []).map((r: any) => ({
                title: r.title || '',
                url: r.url || '',
                snippet: r.content || '',
                score: r.score || 0,
            })),
        };
    } catch {
        return null;
    }
}

/* ═══════════════════════════════════════════
   VALIDATION — Real API calls
   ═══════════════════════════════════════════ */

export async function validateProvider(provider: ProviderName): Promise<ProviderStatus> {
    switch (provider) {
        case 'ollama': {
            try {
                const config = getProviderConfig('ollama');
                const baseUrl = config.baseUrl || 'http://localhost:11434';
                const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
                if (!response.ok) return { available: false, detail: 'Not responding', status: 'error' };
                const data = await response.json();
                const count = data.models?.length || 0;
                return count > 0
                    ? { available: true, detail: `${count} model${count > 1 ? 's' : ''} available`, status: 'valid' }
                    : { available: false, detail: 'No models pulled', status: 'error' };
            } catch {
                return { available: false, detail: 'Not running — start Ollama', status: 'error' };
            }
        }
        case 'openai': {
            const config = getProviderConfig('openai');
            if (!config.apiKey) return { available: false, detail: 'No API key', status: 'no_key' };
            try {
                const response = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKey}` },
                    signal: AbortSignal.timeout(8000),
                });
                if (response.ok) {
                    const data = await response.json();
                    return { available: true, detail: `Key valid · ${data.data?.length || '?'} models`, status: 'valid' };
                }
                const err = await response.json().catch(() => ({}));
                return { available: false, detail: err?.error?.message || 'Invalid key', status: 'invalid' };
            } catch {
                return { available: false, detail: 'Connection failed', status: 'error' };
            }
        }
        case 'anthropic': {
            const config = getProviderConfig('anthropic');
            if (!config.apiKey) return { available: false, detail: 'No API key', status: 'no_key' };
            try {
                const response = await fetch('/api/anthropic/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: config.apiKey }),
                    signal: AbortSignal.timeout(8000),
                });
                const data = await response.json();
                if (data.valid) return { available: true, detail: 'Key valid', status: 'valid' };
                return { available: false, detail: data.error || 'Invalid key', status: 'invalid' };
            } catch {
                return { available: false, detail: 'Validation failed', status: 'error' };
            }
        }
        case 'groq': {
            const config = getProviderConfig('groq');
            if (!config.apiKey) return { available: false, detail: 'No API key — get free at console.groq.com', status: 'no_key' };
            try {
                const response = await fetch('https://api.groq.com/openai/v1/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKey}` },
                    signal: AbortSignal.timeout(8000),
                });
                if (response.ok) return { available: true, detail: 'Key valid — LPU inference ready', status: 'valid' };
                return { available: false, detail: 'Invalid key', status: 'invalid' };
            } catch {
                return { available: false, detail: 'Connection failed', status: 'error' };
            }
        }
        case 'openrouter': {
            const config = getProviderConfig('openrouter');
            if (!config.apiKey) return { available: false, detail: 'No API key — get free at openrouter.ai', status: 'no_key' };
            try {
                const response = await fetch('https://openrouter.ai/api/v1/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKey}` },
                    signal: AbortSignal.timeout(8000),
                });
                if (response.ok) return { available: true, detail: 'Key valid — 300+ models', status: 'valid' };
                return { available: false, detail: 'Invalid key', status: 'invalid' };
            } catch {
                return { available: false, detail: 'Connection failed', status: 'error' };
            }
        }
        case 'tavily': {
            const config = getProviderConfig('tavily');
            if (!config.apiKey) return { available: false, detail: 'No API key', status: 'no_key' };
            try {
                const result = await searchTavily('test', { maxResults: 1 });
                return result
                    ? { available: true, detail: 'Key valid', status: 'valid' }
                    : { available: false, detail: 'Search failed', status: 'invalid' };
            } catch {
                return { available: false, detail: 'Validation failed', status: 'error' };
            }
        }
        case 'gemini': {
            const config = getProviderConfig('gemini');
            if (!config.apiKey) return { available: false, detail: 'No API key — get free at aistudio.google.com/apikey', status: 'no_key' };
            try {
                const response = await fetch(`${GEMINI_BASE}/models?key=${config.apiKey}`, {
                    signal: AbortSignal.timeout(8000),
                });
                if (response.ok) {
                    const data = await response.json();
                    const count = data.models?.filter((m: any) => m.name?.startsWith('models/gemini')).length || 0;
                    return { available: true, detail: `Key valid · ${count} Gemini models`, status: 'valid' };
                }
                const err = await response.json().catch(() => ({}));
                return { available: false, detail: err?.error?.message || 'Invalid key', status: 'invalid' };
            } catch {
                return { available: false, detail: 'Connection failed', status: 'error' };
            }
        }
    }
}

export async function validateAllProviders(): Promise<Record<ProviderName, ProviderStatus>> {
    const [openai, anthropic, ollama, groq, openrouter, gemini, tavily] = await Promise.all([
        validateProvider('openai'),
        validateProvider('anthropic'),
        validateProvider('ollama'),
        validateProvider('groq'),
        validateProvider('openrouter'),
        validateProvider('gemini'),
        validateProvider('tavily'),
    ]);
    return { openai, anthropic, ollama, groq, openrouter, gemini, tavily };
}
