import util from "util";
import fs from "fs";
import {OpenAICompletionCLIOptions} from "./validation";
import path from "path";

// TODO: allow for multiple -p, multiple -f
// TODO: make ordering explicit in help text: -p, args, -f, --prompt-suffix
// TODO: make a prompt_suffix option, which comes very last

export default function concatenatePromptPieces(
    args: string[],
    openaiCompletionCLIOpts: OpenAICompletionCLIOptions,
    promptFileContents: string | undefined,
): string {
    let {prompt_file, prompt_flag, prompt_prefix, prompt_suffix} = openaiCompletionCLIOpts;
    const promptFromArgs = args.join(" ");

    // NOTE: If you add more sources of prompt text, be sure to handle both empty strings and undefined.
    // TODO: make this respect -x trim() or --prompt-joiner?
    const promptPrefix = prompt_prefix ? prompt_prefix + "\n" : "";
    const promptFromFlag = prompt_flag ? prompt_flag + "\n" : "";
    const promptFromFile = prompt_file ? promptFileContents + "\n" : "";
    const promptSuffix = prompt_suffix ? prompt_suffix + "\n" : "";

    // TODO: make this respect -x trim()?
    return `${promptPrefix}${promptFromFlag}${promptFromArgs}${promptFromFile}${promptSuffix}`;
}
