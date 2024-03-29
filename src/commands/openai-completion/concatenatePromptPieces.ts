import {OpenAICompletionCLIOptions} from "./validation";
import {nullGuard} from "../../utils";

// TODO: allow for multiple -p, multiple -f
// TODO: make ordering explicit in help text: --prompt-prefix, -p, args, stdin, -f, --prompt-suffix
// TODO: make a prompt_suffix option, which comes very last

export default function concatenatePromptPieces(
    args: string[],
    openaiCompletionCLIOpts: OpenAICompletionCLIOptions,
    promptFileContents: string | undefined,
): string {
    let {
        promptFlag,
        promptPrefix,
        promptSuffix,
        promptJoiner,
        trailingNewline,
        joiner,
    } = openaiCompletionCLIOpts;

    const actualJoiner = joiner
        ? ""
        : (promptJoiner ?? "");

    const promptFromArgs = args.length > 0 ? args.join(" ") : undefined;

    let stdinText: string | undefined = undefined;
    if ("stdinText" in openaiCompletionCLIOpts) {
        stdinText = openaiCompletionCLIOpts.stdinText;
    }

    // TODO: document this order in --help
    const pieces = [promptPrefix, promptFlag, promptFromArgs, stdinText, promptFileContents, promptSuffix];

    let prompt = pieces.filter(nullGuard).join(actualJoiner);

    if (prompt.length === 0) {
        return "";
    }

    if (trailingNewline) {
        prompt += "\n";
    } else {
        prompt = prompt.replace(/\n+$/, "");
    }

    return prompt;
}
