import type {ChatCompletionRequestMessage, CreateChatCompletionRequest, CreateChatCompletionRequestStop, CreateCompletionRequest} from "openai";

// TODO: Note in --help that echo and best_of? don't work for chat completion
// TODO: add env var for default model
// TODO: function for converting regular completion options to chat completion options
// TODO: add --chat/--no-chat override
// TODO: add --system/--instructions
// TODO: add default system for chat completion

// Values retrieved from https://platform.openai.com/docs/models/model-endpoint-compatibility on 2023-04-08

const KNOWN_COMPLETION_MODELS = [
    "davinci-002",
    "babbage-002",
] as const;
export const KNOWN_COMPLETION_MODELS_SET = new Set(KNOWN_COMPLETION_MODELS);
type KnownCompletionModel = typeof KNOWN_COMPLETION_MODELS[number];

export function isChatCompletionModel(model: string): boolean {
    if (KNOWN_COMPLETION_MODELS_SET.has(model as KnownCompletionModel)) {
        return false;
    } else {
        return true;
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

    let needs_completion_in_name: boolean = isChatCompletionModel(completionRequest.model);

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
