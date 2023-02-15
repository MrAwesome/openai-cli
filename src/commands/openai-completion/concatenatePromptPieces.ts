import {OpenAICompletionCLIOptions} from "./validation";

// TODO: allow for multiple -p, multiple -f
// TODO: make ordering explicit in help text: -p, args, -f, --prompt-suffix
// TODO: make a prompt_suffix option, which comes very last

export default function concatenatePromptPieces(
    args: string[],
    openaiCompletionCLIOpts: OpenAICompletionCLIOptions,
    promptFileContents: string | undefined
): string {
    let {
        prompt_file,
        prompt_flag,
        prompt_prefix,
        prompt_suffix,
        prompt_joiner,
    } = openaiCompletionCLIOpts;
    const promptFromArgs = args.join(" ");

    const promptJoiner = prompt_joiner;

    // NOTE: If you add more sources of prompt text, be sure to handle both empty strings and undefined.
    // TODO: make this respect -x trim()
    const promptPrefix = prompt_prefix ? prompt_prefix + promptJoiner : "";
    const promptFromFlag = prompt_flag ? prompt_flag + promptJoiner : "";
    const promptFromFile = prompt_file
        ? promptFileContents ?? "" + promptJoiner
        : "";
    const promptSuffix = prompt_suffix ? prompt_suffix + promptJoiner : "";

    // TODO: make this respect -x trim()?
    return `${promptPrefix}${promptFromFlag}${promptFromArgs}${promptFromFile}${promptSuffix}`;
}
