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

    const parseRes = parseCLI(process.argv);

    if (parseRes instanceof Error) {
        console.log(parseRes.message);
        process.exit(1);
    }

    const {scriptOpts, openaiOpts, args} = parseRes;

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
        // TODO: more generalized error handling
        await writeFile(tmpDebug, stringifyWithCircularCheck(completion, 2));
        console.log(`[INFO] Debug output written to ${tmpDebug}`);
    }


    // TODO: more generalized error handling
    if (completion.data.choices.length === 0) {
        console.log("No choices returned.");
        process.exit(1);
    }

    // TODO: more generalized error handling
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
