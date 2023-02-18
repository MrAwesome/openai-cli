import {OpenAICompletionCLIOptions} from "./validation";
import {nullGuard} from "../../utils";

// TODO: allow for multiple -p, multiple -f
// TODO: make ordering explicit in help text: -p, args, -f, --prompt-suffix
// TODO: make a prompt_suffix option, which comes very last

export default function concatenatePromptPieces(
    args: string[],
    openaiCompletionCLIOpts: OpenAICompletionCLIOptions,
    promptFileContents: string | undefined
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

    const pieces = [promptPrefix, promptFlag, promptFromArgs, promptFileContents, promptSuffix];

    const finalNewLine = trailingNewline ? "" : "\n";

    const prompt = pieces.filter(nullGuard).join(actualJoiner);

    return prompt.length > 0
        ? prompt + finalNewLine
        : "";
}
