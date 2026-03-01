/* ═══════════════════════════════════════════════════════════════════
   Construct — Cross-Validation Pipeline

   Uses a DIFFERENT model to verify output from the primary model.
   Catches hallucinated API names, wrong types, made-up functions,
   and logical errors that single-model self-review can't find.

   Graceful degradation:
   - Only 1 provider → skip validation (current behavior)
   - 2+ providers → use a different model to validate
   - Primary model = same as validator → use different model/temp
   ═══════════════════════════════════════════════════════════════════ */

import { type AgentPool } from './agentPool';
import {
    type SharedLedger,
    estimateCost,
} from './orchestrationLedger';
import {
    type ChatMessage,
    type ChatResult,
    type ProviderName,
    getSelectedModel,
    chatOpenAI,
    chatAnthropic,
    chatOllama,
    chatGroq,
    chatOpenRouter,
    chatGemini,
} from './providers';

/* ─── Types ─── */

export interface ValidationRequest {
    type: 'code' | 'architecture' | 'research' | 'build_diagnosis';
    content: string;          // the thing to validate
    context: string;          // what it's supposed to accomplish
    primaryModel: string;     // which model produced it
    primaryProvider: ProviderName;
}

export interface ValidationIssue {
    severity: 'error' | 'warning' | 'info';
    description: string;
    location?: string;        // file/line if applicable
}

export interface ValidationResult {
    valid: boolean;
    confidence: number;       // 0-1
    issues: ValidationIssue[];
    suggestions: string[];
    validatorModel: string;
    validatorProvider: ProviderName;
    skipped: boolean;         // true if validation was skipped (no second model)
    skipReason?: string;
}

/* ─── Validation System Prompt ─── */

function buildValidationPrompt(request: ValidationRequest): string {
    const typeInstructions: Record<ValidationRequest['type'], string> = {
        code: `You are a strict code reviewer. Check for:
- Hallucinated API names (functions/methods that don't exist in the stated library)
- Type mismatches and incorrect function signatures
- Logic errors and edge cases not handled
- Missing error handling
- Security vulnerabilities (injection, XSS, CSRF)
- Performance issues (N+1 queries, memory leaks, unbounded loops)
Do NOT suggest style changes. Focus only on correctness.`,

        architecture: `You are a senior architect reviewer. Check for:
- Missing subsystems that the requirements imply
- Circular dependencies between modules
- Data flow gaps (where does state X come from?)
- Scalability bottlenecks
- Single points of failure
- Missing error recovery paths`,

        research: `You are a fact-checker. Verify:
- Do the cited APIs/libraries actually exist?
- Are the version numbers and features accurate?
- Are the code examples syntactically correct?
- Are there deprecated methods being recommended?`,

        build_diagnosis: `You are a build failure analyst. Verify:
- Is the root cause correctly identified?
- Is the suggested fix actually correct?
- Could the fix introduce new issues?
- Are there simpler alternatives?`,
    };

    return `${typeInstructions[request.type]}

IMPORTANT: Another AI model (${request.primaryModel}) produced the content below.
YOUR JOB is to find REAL errors, not to agree with it. Be skeptical.
If everything is correct, say so — but only if you've actually verified each claim.

Respond in this exact JSON format:
{
    "valid": true/false,
    "confidence": 0.0-1.0,
    "issues": [
        {"severity": "error|warning|info", "description": "...", "location": "..."}
    ],
    "suggestions": ["..."]
}

CONTEXT: ${request.context}

CONTENT TO VALIDATE:
${request.content}`;
}

/* ═══════════════════════════════════════════
   VALIDATOR ENGINE
   ═══════════════════════════════════════════ */

/**
 * Cross-validate content using a DIFFERENT model than the one that produced it.
 * Automatically selects the best available validator model.
 */
export async function crossValidate(
    request: ValidationRequest,
    pool: AgentPool,
    ledger: SharedLedger,
): Promise<ValidationResult> {
    // Check if we have a different model available
    const validatorSlot = pickValidator(request.primaryProvider, pool);

    if (!validatorSlot) {
        return {
            valid: true,
            confidence: 0,
            issues: [],
            suggestions: [],
            validatorModel: '',
            validatorProvider: request.primaryProvider,
            skipped: true,
            skipReason: 'No second model available for cross-validation. Add another provider API key to enable.',
        };
    }

    // Log validation start
    ledger.log({
        agentId: validatorSlot.id,
        type: 'validation_started',
        topic: `Validating ${request.type}: ${request.context.slice(0, 80)}`,
        payload: { primaryModel: request.primaryModel, validatorProvider: validatorSlot.provider },
    });

    const messages: ChatMessage[] = [
        { role: 'system', content: 'You are a validation agent. Respond ONLY with JSON. No markdown, no explanations outside the JSON.' },
        { role: 'user', content: buildValidationPrompt(request) },
    ];

    try {
        const model = getSelectedModel(validatorSlot.provider);
        const result = await callProvider(validatorSlot.provider, validatorSlot.apiKey, messages, model);

        if (result.error) {
            pool.markError(validatorSlot.id);
            pool.release(validatorSlot.id);
            return {
                valid: true,
                confidence: 0,
                issues: [],
                suggestions: [],
                validatorModel: model,
                validatorProvider: validatorSlot.provider,
                skipped: true,
                skipReason: `Validator error: ${result.error}`,
            };
        }

        // Track cost
        const tokens = (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0);
        const cost = estimateCost(tokens, model);
        pool.recordCall(validatorSlot.id, tokens);
        pool.release(validatorSlot.id);

        // Parse validation response
        const parsed = parseValidationResponse(result.content);

        // Log completion
        ledger.log({
            agentId: validatorSlot.id,
            type: 'validation_complete',
            topic: `Validated ${request.type}: ${parsed.valid ? 'PASS' : 'FAIL'} (${parsed.issues.length} issues)`,
            payload: parsed,
            cost: { tokens, estimatedUsd: cost },
        });

        // Share insights if issues found
        if (parsed.issues.length > 0) {
            ledger.log({
                agentId: validatorSlot.id,
                type: 'insight_shared',
                topic: 'validation_findings',
                payload: `Cross-validation found ${parsed.issues.length} issue(s): ${parsed.issues.map(i => i.description).join('; ')}`,
            });
        }

        return {
            ...parsed,
            validatorModel: model,
            validatorProvider: validatorSlot.provider,
            skipped: false,
        };
    } catch (err) {
        pool.markError(validatorSlot.id);
        pool.release(validatorSlot.id);
        return {
            valid: true,
            confidence: 0,
            issues: [],
            suggestions: [],
            validatorModel: '',
            validatorProvider: validatorSlot.provider,
            skipped: true,
            skipReason: err instanceof Error ? err.message : 'Validation failed',
        };
    }
}

/* ─── Pick a validator model different from the primary ─── */

function pickValidator(
    primaryProvider: ProviderName,
    pool: AgentPool,
): { id: string; provider: ProviderName; apiKey: string } | null {
    // Preference order for validators (different from primary)
    const preferred: ProviderName[] = ['gemini', 'anthropic', 'openai', 'groq', 'openrouter', 'ollama'];

    // First pass: try a different provider
    for (const provider of preferred) {
        if (provider === primaryProvider) continue;
        const slot = pool.acquire('validator', provider);
        if (slot) return { id: slot.id, provider, apiKey: slot.apiKey };
    }

    // Second pass: same provider but different slot (if multi-key)
    const slot = pool.acquire('validator', primaryProvider);
    if (slot) return { id: slot.id, provider: primaryProvider, apiKey: slot.apiKey };

    return null;
}

/* ─── Call a specific provider ─── */

async function callProvider(
    provider: ProviderName,
    _apiKey: string, // reserved for future per-slot key override
    messages: ChatMessage[],
    model: string,
): Promise<ChatResult> {
    const options = { model, temperature: 0.1, maxTokens: 2048 }; // Low temp for validation

    switch (provider) {
        case 'gemini': return chatGemini(messages, options);
        case 'openai': return chatOpenAI(messages, options);
        case 'anthropic': return chatAnthropic(messages, options);
        case 'groq': return chatGroq(messages, options);
        case 'openrouter': return chatOpenRouter(messages, options);
        case 'ollama': return chatOllama(messages, options);
        default: return { content: '', model, provider, error: `Unknown provider: ${provider}` };
    }
}

/* ─── Parse the validation JSON response ─── */

function parseValidationResponse(raw: string): {
    valid: boolean;
    confidence: number;
    issues: ValidationIssue[];
    suggestions: string[];
} {
    // Try to extract JSON from the response (model might wrap it in markdown)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return {
            valid: true,
            confidence: 0.5,
            issues: [{ severity: 'info', description: 'Validator response was not parseable JSON' }],
            suggestions: [],
        };
    }

    try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            valid: parsed.valid !== false, // default to valid if ambiguous
            confidence: typeof parsed.confidence === 'number'
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.5,
            issues: Array.isArray(parsed.issues)
                ? parsed.issues.map((i: any) => ({
                    severity: ['error', 'warning', 'info'].includes(i.severity) ? i.severity : 'info',
                    description: String(i.description || ''),
                    location: i.location ? String(i.location) : undefined,
                }))
                : [],
            suggestions: Array.isArray(parsed.suggestions)
                ? parsed.suggestions.map(String)
                : [],
        };
    } catch {
        return {
            valid: true,
            confidence: 0.3,
            issues: [{ severity: 'info', description: 'Validator returned malformed JSON' }],
            suggestions: [],
        };
    }
}

/* ═══════════════════════════════════════════
   SHOULD VALIDATE DECISION LOGIC
   ═══════════════════════════════════════════ */

/**
 * Determine whether this output warrants cross-validation.
 * Avoids wasting tokens on trivial operations.
 */
export function shouldValidate(
    operation: string,
    content: string,
    pool: AgentPool,
): boolean {
    // Never validate if no second model available
    if (!pool.isMultiAgentAvailable()) return false;

    // Skip trivial operations
    const skipOps = ['read_file', 'list_directory', 'search_files', 'find_symbol',
        'check_imports', 'detect_environment', 'health_check', 'task_complete'];
    if (skipOps.includes(operation)) return false;

    // Always validate file creation (code generation)
    if (operation === 'create_file') return true;

    // Validate edits over 10 lines
    if (operation === 'edit_file' && content.split('\n').length > 10) return true;

    // Validate architecture analysis
    if (operation === 'analyze_architecture') return true;

    // Validate after build failures
    if (operation === 'run_command' && (content.includes('error') || content.includes('failed'))) return true;

    return false;
}
