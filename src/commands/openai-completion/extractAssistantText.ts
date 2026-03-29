import type {
    ChatCompletion,
    ChatCompletionMessage,
} from "openai/resources/chat/completions";

/** API responses may use string or structured parts for `message.content`. */
function normalizeContent(content: ChatCompletionMessage["content"] | unknown): string {
    if (content == null) {
        return "";
    }
    if (typeof content === "string") {
        return content;
    }
    if (Array.isArray(content)) {
        let out = "";
        for (const part of content) {
            if (!part || typeof part !== "object") {
                continue;
            }
            const p = part as Record<string, unknown>;
            if (p.type === "text" && typeof p.text === "string") {
                out += p.text;
            } else if (p.type === "refusal" && typeof p.refusal === "string") {
                out += p.refusal;
            }
        }
        return out;
    }
    return "";
}

export function assistantMessageToText(message: ChatCompletionMessage): string {
    let text = normalizeContent(message.content as unknown);
    if (!text && message.refusal) {
        text = message.refusal;
    }
    return text;
}

export function choiceToTextOrError(
    choice: ChatCompletion["choices"][number],
): {ok: true; text: string} | {ok: false; error: string} {
    const {message, finish_reason} = choice;
    if (message.tool_calls && message.tool_calls.length > 0) {
        return {
            ok: false,
            error:
                "[ERROR] The model returned tool calls instead of a text reply; this CLI expects a plain assistant message.",
        };
    }
    const text = assistantMessageToText(message);
    if (text.trim() !== "") {
        return {ok: true, text};
    }
    if (finish_reason === "length") {
        return {
            ok: false,
            error:
                "[ERROR] No text returned; try a larger --max-tokens (reasoning models use part of the budget internally).",
        };
    }
    if (finish_reason === "content_filter") {
        return {ok: false, error: "[ERROR] No text returned (content filtered)."};
    }
    return {ok: false, error: "[ERROR] No text returned."};
}
