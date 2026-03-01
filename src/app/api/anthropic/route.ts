import { NextRequest, NextResponse } from "next/server";

/**
 * Anthropic API Proxy — needed because Anthropic doesn't support browser CORS.
 * This server-side route forwards requests to the Anthropic API.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { apiKey, model, system, messages, temperature, max_tokens, stream } = body;

        if (!apiKey) {
            return NextResponse.json({ error: "No API key provided" }, { status: 400 });
        }

        const anthropicBody: Record<string, unknown> = {
            model: model || "claude-sonnet-4-20250514",
            messages,
            max_tokens: max_tokens || 4096,
            temperature: temperature ?? 0.3,
        };

        if (system) {
            anthropicBody.system = system;
        }

        if (stream) {
            anthropicBody.stream = true;

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": apiKey,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify(anthropicBody),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                return NextResponse.json(
                    { error: err?.error?.message || `Anthropic HTTP ${response.status}` },
                    { status: response.status }
                );
            }

            // Forward the SSE stream
            return new NextResponse(response.body, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                },
            });
        }

        // Non-streaming
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(anthropicBody),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: err?.error?.message || `Anthropic HTTP ${response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json({
            content: data.content?.[0]?.text || "",
            model: data.model,
            usage: data.usage
                ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
                : undefined,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
