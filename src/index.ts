import CLIRunner from "./CLIRunner";
import {ScriptContext} from "./types";
import dotenv from 'dotenv';

dotenv.config();

// TODO: important: fix file reading (didn't seem to throw an error when given an invalid file) - it seems like file reading is entirely broken?
// TODO: automatically set max_tokens to near the max by estimating token length num and subtracting from known model max (is there a library for estimation?)
// TODO: IMPORTANT: don't let remote users use: -f, -u, or -d
// TODO: --prompt-prefix, --prompt-suffix, --prompt-joiner (support \n -> newline, \t -> tab, etc)
// TODO: make --n canonical, make --repeat an alias
// TODO: allow for stdin (use process.stdin.isTTY)
// TODO: support for conversation mode in readline (option for Q./A. / other prefixes)
// TODO: aliases/helpers for codex, etc
// TODO: add dall-e command - handle --n
// TODO: s/subcommand/command/
// TODO: store defaults in overrideable config file
// TODO: use readline to allow for interactive mode
// TODO: integrate with signal/sms bots
// TODO: conversation mode (needs limits, clear way to indicate end of conversation)
// TODO: commands: list_models, help/--help
// TODO: don't let user set max_tokens to more than the model allows
// TODO: interspersed -f and arguments/-p, for use in code generation
// TODO: shortcuts for "write unit tests for" and "write a program that" (and maybe others)
// TODO: in-place code replacement (e.g. "replace all calls to console.log with logger")

// Projects:
// [] Conversation mode
//   [] Indicate conversations should be stored via a flag/arg?
//   [] Live convo mode in the terminal/repl
//   [] Live convo mode for chat?

//// TODO: command to list all known models (including user's own models)
//// TODO: command to check models all still exist / verify info
const KNOWN_MODELS = {
    "text-davinci-003": {max_tokens: 4000},
    "text-curie-001": {max_tokens: 2048},
    "text-babbage-001": {max_tokens: 2048},
    "text-ada-001": {max_tokens: 2048},
    "code-davinci-002": {max_tokens: 8000},
    "code-cushman-001": {max_tokens: 2048},
} as const;

type KnownModelName = keyof typeof KNOWN_MODELS;

async function localRun() {
    // CLI_IS_REMOTE is just a way to test remote behavior for local runs.
    const scriptContext: ScriptContext = process.env.CLI_IS_REMOTE === "true" ? {
        rawArgs: process.argv.slice(2),
        isRemote: true,
        serverAdminContactInfo: "test-admin@test.admin",
    } : {
        rawArgs: process.argv,
        isRemote: false,
    };

    const runner = new CLIRunner(scriptContext);
    const res = await runner.run();
    if (res.status === "success") {
        console.log(res.output);
    }
    if (res.status === "failure_safe") {
        console.error(res.stderr);
    }
    if (res.status === "failure_unsafe") {
        console.error(res.error);
        console.error(res.stderr);
    }
    if (res.status === "exit") {
        console.log(res.output);
    }
    process.exit(res.exitCode);
}

if (require.main === module) {
    localRun();
}
