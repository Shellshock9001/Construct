import { NextRequest, NextResponse } from "next/server";

/**
 * Anthropic Key Validation — lightweight check via a minimal messages call.
 */
export async function POST(request: NextRequest) {
    try {
        const { apiKey } = await request.json();

        if (!apiKey) {
            return NextResponse.json({ valid: false, error: "No key provided" });
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-3-5-haiku-20241022",
                max_tokens: 1,
                messages: [{ role: "user", content: "hi" }],
            }),
        });

        if (response.ok || response.status === 200) {
            return NextResponse.json({ valid: true });
        }

        // 401 = invalid key, 429 = rate limit (key is valid but throttled)
        if (response.status === 429) {
            return NextResponse.json({ valid: true, detail: "Rate limited but key valid" });
        }

        const err = await response.json().catch(() => ({}));
        return NextResponse.json({
            valid: false,
            error: err?.error?.message || `HTTP ${response.status}`,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Validation failed";
        return NextResponse.json({ valid: false, error: message });
    }
}
