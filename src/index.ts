import {Configuration, OpenAIApi} from "openai";
import * as dotenv from 'dotenv';
import util from 'util';
import fs from 'fs';
import {stringifyWithCircularCheck} from "./utils";
import {parseCLI} from "./parseCLI";

const start = Date.now();

// TODO: IMPORTANT: don't let chat mode users use: -f, -a, -u, or 
// TODO: use readline to allow for interactive mode
// TODO: integrate with signal/sms bots
// TODO: conversation mode (needs limits, clear way to indicate end of conversation)
// TODO: commands: list_models, help/--help
// TODO: don't let user set max_tokens to more than the model allows
// TODO: interspersed -f and arguments/-p, for use in code generation
// TODO: shortcuts for "write unit tests for" and "write a program that" (and maybe others)
// TODO: in-place code replacement (e.g. "replace all calls to console.log with logger")

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
dotenv.config();

// Args:
//  -m/--model: The model to use. Defaults to text-davinci-003
//  -t/--temperature: The temperature to use. Defaults to 0.6
//  -T/--top-p: The top-p to use. Not recommended to alter both top_p and temperature at the same time. Defaults to 1.0
//  -p/--prompt: The prompt to use. Defaults to "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly."
//  -s/--stop: The stop sequence to use. Defaults to newline(?)
//  -d/--debug: Enable debug mode
//  -h/--help: Display help
//  -v/--version: Display version
//  -c/--choice: The choice to use. Defaults to 0
//  -r/--repeat: How many times to repeat the prompt to the model. Careful using large values, as this can quickly eat through your quota. Defaults to 1.
//  -l/--log-probability-threshold: The log probability threshold to use. Defaults to 0.0
//  -e/--echo: Echo the prompt to the console
//  -a/--api-key: The API key to use. Defaults to OPENAI_API_KEY environment variable
//  -f/--file: The file to use. Defaults to none
//  -F/--frequency-penalty: The frequency penalty to use. Defaults to 0.0
//  -b/--best-of: The number of choices to return. Defaults to 1
//  -u/--user: The user to use. Defaults to none
//  -M/--max-tokens: The max tokens to use *for the total completion, including the prompt and response*. Defaults to 1024


interface ModelSpecificSettings {
    max_tokens: number;
}

// TODO: command to list all known models (including user's own models)
// TODO: command to check models all still exist / verify info
const KNOWN_MODELS = {
    "text-davinci-003": {max_tokens: 4000},
    "text-curie-001": {max_tokens: 2048},
    "text-babbage-001": {max_tokens: 2048},
    "text-ada-001": {max_tokens: 2048},
    "code-davinci-002": {max_tokens: 8000},
    "code-cushman-001": {max_tokens: 2048},
} as const;

type KnownModelName = keyof typeof KNOWN_MODELS;

// TODO: move api key check

export async function main() {
    //const {options} = parseArgs(process.argv.slice(2));

    const {scriptOpts, openaiOpts, args} = parseCLI(process.argv);

    // TODO: check for -p and -f prompts here in a function (find out how to get them from the opts object)
    if (args.length === 0 && scriptOpts.file === undefined) {
        console.log('[ERROR] No prompt text was provided.');
        process.exit(1);
    }

    // TODO: handle -f, etc
    const prompt = args.join(" ");
    
    //console.log({opts, args});
    const {file, debug} = scriptOpts;
    const {api_key, model, temperature, echo, max_tokens, repeat, frequency_penalty} = openaiOpts;
    // NOTE: Despite the API options all being snake_case, the node client uses "apiKey"
    const configuration = new Configuration({apiKey: api_key});
    const openai = new OpenAIApi(configuration);

    // TODO: handle multiple -f?
    let promptFileContents: string | undefined = undefined;
    if (file !== undefined) {
        // TODO: just make these mutually exclusive
        // Log to stderr
        process.stderr.write(`[INFO] The -f flag was passed, so any prompt text args will be ignored.\n`);
        promptFileContents = await readFile(file, "utf8");
    }

    const completion = await openai.createCompletion({
        model,
        //temperature,
        prompt: promptFileContents ?? prompt,
        max_tokens,
        echo,
        //frequency_penalty,
        //n: repeat,
    }).catch((e) => {
        console.log(e.response.data.error.message);
        process.exit(1);
    });

    if (debug) {
        console.log(completion);
        // TODO: better location, not just /tmp (can be in a throwaway dir in the project)
        const tmpDebug = "/tmp/openai-debug.json";
        await writeFile(tmpDebug, stringifyWithCircularCheck(completion, 2));
        console.log(`[INFO] Debug output written to ${tmpDebug}`);
    }


    if (completion.data.choices.length === 0) {
        console.log("No choices returned.");
        process.exit(1);
    }

    if (completion.data.choices[0].text === "") {
        console.log("No text returned.");
        process.exit(1);
    }

    if (completion.data.choices.length > 1) {
        completion.data.choices.forEach((choice, i) => {
            console.log(choice.text?.trim());
        });
    } else {
        console.log(completion.data.choices[0].text?.trim());
    }

    return completion;
}

main();
