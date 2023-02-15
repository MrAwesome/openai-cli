export const KNOWN_SUBCOMMAND_NAMES = ["openai-completion"] as const;
export type KnownSubCommandName = typeof KNOWN_SUBCOMMAND_NAMES[number];
export const KNOWN_SUBCOMMAND_NAMES_SET = new Set(KNOWN_SUBCOMMAND_NAMES);

export const DEFAULT_SUBCOMMAND_NAME = "openai-completion" as const;

export const DEFAULT_OPENAI_REMOTE_USER = "remote_user" as const;

export const SCRIPT_DEFAULTS = {
    debug: false,
    help: false,
    version: false,
} as const;

// TODO: mapping from these to the openai api for repeat/logprobs and anything else with a name that isn't the same (can just do a function that manually picks/excludes)
export const OPENAI_COMPLETION_DEFAULTS = {
    trim: false,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    max_tokens: 1024,
    model: 'text-davinci-003',
    repeat: 1,
    temperature: 0.6,
    best_of: 1,
    echo: false,
    stream: false,
    suffix: undefined,
    logit_bias: undefined,
    stop: undefined,
    top_p: 1.0,
    user: undefined,
    // The backslash here is to allow the current file to be parsed by ai tooling
    prompt_flag: undefined,
    prompt_file: undefined,
    prompt_suffix: undefined,
    prompt_prefix: undefined,
    prompt_joiner: "\n",
    // Unused, as they don't add anything to the functionality of a CLI:
    //logprobs: 0.0,
} as const;

// TODO: unit/integration test that this is returned as stderr when the API key is invalid/missing
export const OPENAI_API_KEY_NOT_SET_ERROR = `[ERROR] OPENAI_API_KEY environment variable not set. 
Step 1) Go to https://beta.openai.com/account/api-keys to get an API key.
Step 2) Open the file .env in the root of this project, and add the following line, without the angle brackets:
OPENAI_API_KEY=<your API key>` as const;
