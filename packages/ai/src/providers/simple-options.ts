import type { Api, Model, SimpleStreamOptions, StreamOptions, ThinkingBudgets, ThinkingLevel } from "../types.js";

export function buildBaseOptions(model: Model<Api>, options?: SimpleStreamOptions, apiKey?: string): StreamOptions {
	return {
		temperature: options?.temperature,
		maxTokens: options?.maxTokens || Math.min(model.maxTokens, 32000),
		signal: options?.signal,
		apiKey: apiKey || options?.apiKey,
		cacheRetention: options?.cacheRetention,
		sessionId: options?.sessionId,
		headers: options?.headers,
		onPayload: options?.onPayload,
		maxRetryDelayMs: options?.maxRetryDelayMs,
		metadata: options?.metadata,
	};
}

/**
 * Clamp ThinkingLevel to levels supported by most providers (excludes xhigh, max, auto).
 * Used by Google, Bedrock, and other providers that only support minimal/low/medium/high.
 */
export function clampReasoning(
	effort: ThinkingLevel | undefined,
): Exclude<ThinkingLevel, "xhigh" | "max" | "auto"> | undefined {
	if (effort === "xhigh" || effort === "max") return "high";
	if (effort === "auto") return "high";
	return effort;
}

/**
 * Clamp ThinkingLevel for OpenAI providers (supports xhigh but not max/auto).
 * For models supporting xhigh, passes minimal/low/medium/high/xhigh through.
 * Anthropic-specific levels (max, auto) are mapped to their closest equivalents.
 */
export function clampReasoningForOpenAI(
	effort: ThinkingLevel | undefined,
	modelSupportsXhigh: boolean,
): Exclude<ThinkingLevel, "max" | "auto"> | undefined {
	if (effort === "max") return modelSupportsXhigh ? "xhigh" : "high";
	if (effort === "auto") return "high";
	if (effort === "xhigh" && !modelSupportsXhigh) return "high";
	return effort;
}

export function adjustMaxTokensForThinking(
	baseMaxTokens: number,
	modelMaxTokens: number,
	reasoningLevel: ThinkingLevel,
	customBudgets?: ThinkingBudgets,
): { maxTokens: number; thinkingBudget: number } {
	const defaultBudgets: ThinkingBudgets = {
		minimal: 1024,
		low: 2048,
		medium: 8192,
		high: 16384,
	};
	const budgets = { ...defaultBudgets, ...customBudgets };

	const minOutputTokens = 1024;
	const level = clampReasoning(reasoningLevel)!;
	let thinkingBudget = budgets[level]!;
	const maxTokens = Math.min(baseMaxTokens + thinkingBudget, modelMaxTokens);

	if (maxTokens <= thinkingBudget) {
		thinkingBudget = Math.max(0, maxTokens - minOutputTokens);
	}

	return { maxTokens, thinkingBudget };
}
