import type {ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionRequestStop, CreateCompletionRequest} from "openai";

// TODO: Note in --help that echo and best_of? don't work for chat completion
// TODO: add env var for default model
// TODO: function for converting regular completion options to chat completion options
// TODO: add --chat/--no-chat override
// TODO: add --system/--instructions
// TODO: add default system for chat completion

// Values retrieved from https://platform.openai.com/docs/models/model-endpoint-compatibility on 2023-04-08

const KNOWN_CHAT_COMPLETION_MODELS = [
    "gpt-4",
    "gpt-4o",
    "o1-mini",
    "o1-preview",
    "o1",
    "o3-mini",
    "gpt-4-0314",
    "gpt-4-32k",
    "gpt-4-32k-0314",
    "gpt-3.5-turbo",
    "gpt-3.5-turbo-0301",
] as const;
export const KNOWN_CHAT_COMPLETION_MODELS_SET = new Set(KNOWN_CHAT_COMPLETION_MODELS);
type KnownChatCompletionModel = typeof KNOWN_CHAT_COMPLETION_MODELS[number];

export const INFERRED_CHAT_COMPLETION_MODEL_REGEX: RegExp = /^(gpt-3.5-turbo|gpt-4)/;

const KNOWN_COMPLETION_MODELS = [
    "text-davinci-003",
    "text-davinci-002",
    "text-curie-001",
    "text-babbage-001",
    "text-ada-001",
    "davinci",
    "curie",
    "babbage",
    "ada",
] as const;
export const KNOWN_COMPLETION_MODELS_SET = new Set(KNOWN_COMPLETION_MODELS);

export function isChatCompletionModel(model: string): "probably" | true | false {
    if (KNOWN_CHAT_COMPLETION_MODELS_SET.has(model as KnownChatCompletionModel)) {
        return true;
    } else if (model.match(INFERRED_CHAT_COMPLETION_MODEL_REGEX)) {
        return "probably";
    } else {
        return false;
    }
}

// TODO: unit test
export function convertCompletionRequestToChatCompletionRequest(
    completionRequest: CreateCompletionRequest,
    system?: string,
): CreateChatCompletionRequest {
    const {prompt, ...rest} = completionRequest;

    const messages: ChatCompletionRequestMessage[] = [];
    if (system) {
        messages.push({role: "system", content: system});
    }

    // We're sure that prompt is a string here, because we've already validated it upstream
    messages.push({role: "user", content: prompt as string});

    let stop: CreateChatCompletionRequestStop | undefined;
    if (completionRequest.stop === null) {
        stop = undefined;
    } else {
        stop = completionRequest.stop;
    }

    let needs_completion_in_name: boolean = completionRequest.model.startsWith("o1") || completionRequest.model.startsWith("o3");

    let max_tokens: number | undefined;
    let max_completion_tokens: number | undefined;
    if (completionRequest.max_tokens === null || needs_completion_in_name) {
        max_tokens = undefined;
    } else {
        max_tokens = completionRequest.max_tokens;
    }

    delete rest.best_of;
    delete rest.echo;

    if (needs_completion_in_name) {
        max_completion_tokens = max_tokens;
        delete rest.max_tokens;
        return {
            ...rest,
            // @ts-ignore
            max_completion_tokens,
            messages,
            stop,
        };
    }

    return {
        ...rest,
        max_tokens,
        messages,
        stop,
    };
}
