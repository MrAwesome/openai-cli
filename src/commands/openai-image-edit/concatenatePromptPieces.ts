import {OpenAIImageEditCLIOptions} from "./validation";
import {nullGuard} from "../../utils";

export default function concatenateImageEditPromptPieces(
    args: string[],
    opts: OpenAIImageEditCLIOptions,
    promptFileContents: string | undefined,
): string {
    let {
        promptFlag,
        promptPrefix,
        promptSuffix,
        promptJoiner,
        trailingNewline,
        joiner,
    } = opts;

    const actualJoiner = joiner
        ? ""
        : (promptJoiner ?? "");

    const promptFromArgs = args.length > 0 ? args.join(" ") : undefined;

    let stdinText: string | undefined = undefined;
    if ("stdinText" in opts) {
        stdinText = opts.stdinText;
    }

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
