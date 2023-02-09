import util from "util";
import fs from "fs";
import {OpenAICompletionCLIOptions} from "./validation";

const readFile = util.promisify(fs.readFile);

// TODO: allow for multiple -p, multiple -f
// TODO: make ordering explicit in help text: -p, args, -f, --prompt-suffix
// TODO: make a prompt_suffix option, which comes very last

export default async function constructPrompt(
    args: string[],
    openaiCompletionCLIOpts: OpenAICompletionCLIOptions
): Promise<string> {
    let {prompt_file, prompt_flag, prompt_suffix} = openaiCompletionCLIOpts;
    const promptFromArgs = args.join(" ");

    // NOTE: If you add more sources of prompt text, be sure to handle both empty strings and undefined.
    const promptFromFlag = prompt_flag ? prompt_flag + "\n" : "";
    const promptFromFile = prompt_file
        ? (await readFile(prompt_file, "utf8")) + "\n"
        : "";
    const promptSuffix = prompt_suffix ? prompt_suffix + "\n" : "";

    //if debug:
    //console.log({promptFromFlag, promptFromArgs, promptFromFile, promptSuffix});

    // TODO: make this respect -x trim()?
    return `${promptFromFlag}${promptFromArgs}${promptFromFile}${promptSuffix}`;
}
