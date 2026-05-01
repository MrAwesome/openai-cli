import type {
    ChatCompletionContentPart,
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type {OpenAICompletionAPIOptions} from "./validation";
import type {KnownProvider} from "../../defaultSettings";

export function convertCompletionRequestToChatCompletionRequest(
    completionRequest: OpenAICompletionAPIOptions,
    system?: string,
    userContent?: string | ChatCompletionContentPart[],
    provider: KnownProvider = "openai",
): ChatCompletionCreateParamsNonStreaming {
    const {
        prompt,
        stream: _stream,
        max_completion_tokens,
        ...rest
    } = completionRequest;

    const messages: ChatCompletionMessageParam[] = [];
    if (system) {
        messages.push({role: "system", content: system});
    }

    const userMessageContent =
        userContent !== undefined ? userContent : (prompt as string);
    messages.push({role: "user", content: userMessageContent});

    let stop: ChatCompletionCreateParamsNonStreaming["stop"];
    if (completionRequest.stop === null || completionRequest.stop === undefined) {
        stop = undefined;
    } else {
        stop = completionRequest.stop;
    }

    const request: ChatCompletionCreateParamsNonStreaming = {
        ...rest,
        messages,
        stop,
        max_completion_tokens,
    };

    // Gemini's OpenAI-compatible chat endpoint can reject some OpenAI-specific fields
    // with a generic "400 status code (no body)". Trim those fields for compatibility.
    if (provider === "gemini") {
        const geminiRequest = request as ChatCompletionCreateParamsNonStreaming & {
            max_tokens?: number;
            max_completion_tokens?: number;
            user?: string;
            presence_penalty?: number;
            frequency_penalty?: number;
            logit_bias?: Record<string, number> | null;
        };

        if (geminiRequest.max_completion_tokens !== undefined) {
            geminiRequest.max_tokens = geminiRequest.max_completion_tokens;
        }
        delete geminiRequest.max_completion_tokens;
        delete geminiRequest.user;
        delete geminiRequest.presence_penalty;
        delete geminiRequest.frequency_penalty;
        delete geminiRequest.logit_bias;
    }

    return request;
}
