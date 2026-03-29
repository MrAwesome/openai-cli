import type {
    ChatCompletionCreateParamsNonStreaming,
    ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type {OpenAICompletionAPIOptions} from "./validation";

export function convertCompletionRequestToChatCompletionRequest(
    completionRequest: OpenAICompletionAPIOptions,
    system?: string,
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

    messages.push({role: "user", content: prompt as string});

    let stop: ChatCompletionCreateParamsNonStreaming["stop"];
    if (completionRequest.stop === null || completionRequest.stop === undefined) {
        stop = undefined;
    } else {
        stop = completionRequest.stop;
    }

    return {
        ...rest,
        messages,
        stop,
        max_completion_tokens,
    };
}
