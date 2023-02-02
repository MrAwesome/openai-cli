import {Configuration, OpenAIApi} from "openai";
import * as dotenv from 'dotenv';
import util from 'util';
import fs from 'fs';
const start = Date.now();

// TODO: use readline to allow for interactive mode

const readFile = util.promisify(fs.readFile);

dotenv.config();

// Args:
//  -m/--model: The model to use. Defaults to text-davinci-003
//  -t/--temperature: The temperature to use. Defaults to 0.6
//  -T/--top-p: The top-p to use. Not recommended to alter both top_p and temperature at the same time. Defaults to 1.0
//  -p/--prompt: The prompt to use. Defaults to "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly."
//  -n/--num-tokens: The number of tokens to generate. Defaults to 1024
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
//  

class Options {
    apiKey: string;
    model: string = "text-davinci-003";
    temperature: number = 0.6;
    prompt: string = "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly.";
    max_tokens: number = 1024;
    frequency_penalty?: number;
    repeat: number = 1;
    stop: string = "\n"; // TODO: unused
    debug: boolean = false; // TODO: unused
    help: boolean = false; // TODO: unused
    version: boolean = false; // TODO: unused
    choice: number = 0; // TODO: unused
    logProbabilityThreshold?: number; // TODO: unused
    echo?: boolean; // TODO: unused
    file?: string; // TODO: unused
    bestOf: number = 1; // TODO: unused
    user?: string = process.env.USER; // TODO: unused
    top_p?: number; // TODO: unused

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }
}

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

function parseArgs(args: string[]): {options: Options} {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        console.log(`
[ERROR] OPENAI_API_KEY environment variable not set. 
Step 1) Go to https://beta.openai.com/account/api-keys to get an API key.
Step 2) Open the file .env in the root of this project, and add the following line, without the angle brackets:
OPENAI_API_KEY=<your API key>
        `.trim());
        process.exit(1);
    }
    const options = new Options(apiKey);
    const promptPieces: string[] = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case "-d":
            case "--debug":
                options.debug = true;
                break;
            case "-m":
            case "--model":
                options.model = args[++i];
                break;
            case "-t":
            case "--temperature":
                options.temperature = parseFloat(args[++i]);
                break;
            case "-p":
            case "--prompt":
                options.prompt = args[++i];
                break;
            case "-M":
            case "--max-tokens":
                options.max_tokens = parseInt(args[++i]);
                break;
            case "-s":
            case "--stop":
                options.stop = args[++i];
                break;
            case "-h":
            case "--help":
                options.help = true;
                break;
            case "-v":
            case "--version":
                options.version = true;
                break;
            case "-c":
            case "--choice":
                options.choice = parseInt(args[++i]);
                break;
            case "-r":
            case "--repeat":
                options.repeat = parseInt(args[++i]);
                break;
            case "-F":
            case "--frequency-penalty":
                options.frequency_penalty = parseFloat(args[++i]);
                break;
            case "-l":
            case "--log-probability-threshold":
                options.logProbabilityThreshold = parseFloat(args[++i]);
                break;
            case "-e":
            case "--echo":
                options.echo = true;
                break;
            case "-a":
            case "--api-key":
                options.apiKey = args[++i];
                break;
            case "-f":
            case "--file":
                options.file = args[++i];
                break;
            case "-b":
            case "--best-of":
                options.bestOf = parseInt(args[++i]);
                break;
            case "-u":
            case "--user":
                options.user = args[++i];
                break;
            default:
                promptPieces.push(arg);
        }
    }

    options.prompt = promptPieces.join(" ");

    return {options};
}



export async function main() {
    const {options} = parseArgs(process.argv.slice(2));
    const {apiKey, model, temperature, prompt, max_tokens, repeat, frequency_penalty, file, debug} = options;

    const configuration = new Configuration({
        apiKey,
    });
    const openai = new OpenAIApi(configuration);

    let promptFileContents: string | undefined = undefined;
    if (file !== undefined) {
        // Log to stderr
        process.stderr.write(`[INFO] The -f flag was passed, so any prompt text args will be ignored.\n`);
        promptFileContents = await readFile(file, "utf8");
    }

    const completion = await openai.createCompletion({
        model,
        temperature,
        prompt: promptFileContents ?? prompt,
        max_tokens,
        frequency_penalty,
        n: repeat,
    });

    if (debug) {
        console.log(completion);
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
