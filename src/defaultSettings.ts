export const KNOWN_SUBCOMMAND_NAMES = ["openai-completion"] as const;
export type KnownSubCommandName = typeof KNOWN_SUBCOMMAND_NAMES[number];
export const KNOWN_SUBCOMMAND_NAMES_SET = new Set(KNOWN_SUBCOMMAND_NAMES);

export const DEFAULT_SUBCOMMAND_NAME = "openai-completion" as const;

export const DEFAULT_OPENAI_REMOTE_USER = "remote_user" as const;

const DEFAULT_FALLBACK_OPENAI_COMPLETION_MODEL = "text-davinci-003" as const;
export const DEFAULT_OPENAI_COMPLETION_MODEL = process.env.DEFAULT_OPENAI_COMPLETION_MODEL || DEFAULT_FALLBACK_OPENAI_COMPLETION_MODEL;

// TODO: unit/integration test that this is returned as stderr when the API key is invalid/missing
export const OPENAI_API_KEY_NOT_SET_ERROR = `[ERROR] OPENAI_API_KEY environment variable not set.
Step 1) Go to https://beta.openai.com/account/api-keys to get an API key.
Step 2) Open the file .env in the root of this project, and add the following line, without the angle brackets:
OPENAI_API_KEY=<your API key>` as const;
