import type {
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type {OpenAICompletionAPIOptions} from "./validation";

// TODO: Note in --help that echo and best_of? don't work for chat completion
// TODO: add env var for default model
// TODO: add --chat/--no-chat override
// TODO: add default system for chat completion

const KNOWN_COMPLETION_MODELS = [
    "davinci-002",
    "babbage-002",
] as const;
export const KNOWN_COMPLETION_MODELS_SET = new Set(KNOWN_COMPLETION_MODELS);
type KnownCompletionModel = typeof KNOWN_COMPLETION_MODELS[number];

export function isChatCompletionModel(model: string): boolean {
    if (KNOWN_COMPLETION_MODELS_SET.has(model as KnownCompletionModel)) {
        return false;
    }
    return true;
}

export function convertCompletionRequestToChatCompletionRequest(
    completionRequest: OpenAICompletionAPIOptions,
    system?: string,
): ChatCompletionCreateParamsNonStreaming {
    const {
        prompt,
        best_of: _bestOf,
        echo: _echo,
        stream: _stream,
        ...rest
    } = completionRequest;

    const messages: ChatCompletionMessageParam[] = [];
    if (system) {
        messages.push({role: "system", content: system});
    }

    messages.push({role: "user", content: prompt as string});

    let stop: ChatCompletionCreateParamsNonStreaming["stop"];
    if (completionRequest.stop === null || completionRequest.stop === undefined) {
        stop = undefined;
    } else {
        stop = completionRequest.stop;
    }

    const useMaxCompletionTokens = isChatCompletionModel(completionRequest.model);

    let max_tokens: number | null | undefined;
    let max_completion_tokens: number | null | undefined;
    if (completionRequest.max_tokens === null || completionRequest.max_tokens === undefined || useMaxCompletionTokens) {
        max_tokens = undefined;
    } else {
        max_tokens = completionRequest.max_tokens;
    }

    if (useMaxCompletionTokens) {
        max_completion_tokens = completionRequest.max_tokens ?? undefined;
        return {
            ...rest,
            messages,
            stop,
            max_completion_tokens,
        };
    }

    return {
        ...rest,
        messages,
        stop,
        max_tokens,
    };
}
