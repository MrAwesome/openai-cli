import dotenv from 'dotenv';
dotenv.config();

export const KNOWN_PROVIDERS = ["openai", "gemini"] as const;
export type KnownProvider = typeof KNOWN_PROVIDERS[number];

export const KNOWN_SUBCOMMAND_NAMES = ["openai-completion", "openai-image"] as const;
export type KnownSubCommandName = typeof KNOWN_SUBCOMMAND_NAMES[number];
export const KNOWN_SUBCOMMAND_NAMES_SET = new Set(KNOWN_SUBCOMMAND_NAMES);

export const DEFAULT_SUBCOMMAND_NAME = "openai-completion" as const;

export const DEFAULT_PROVIDER: KnownProvider =
    (process.env.DEFAULT_AI_PROVIDER as KnownProvider | undefined) ?? "openai";

export const DEFAULT_REMOTE_USER = "remote_user" as const;

const DEFAULT_FALLBACK_OPENAI_COMPLETION_MODEL = "gpt-5-mini" as const;
export const DEFAULT_OPENAI_COMPLETION_MODEL = process.env.DEFAULT_OPENAI_COMPLETION_MODEL || DEFAULT_FALLBACK_OPENAI_COMPLETION_MODEL;

const DEFAULT_FALLBACK_GEMINI_COMPLETION_MODEL = "gemini-2.5-flash" as const;
export const DEFAULT_GEMINI_COMPLETION_MODEL = process.env.DEFAULT_GEMINI_COMPLETION_MODEL || DEFAULT_FALLBACK_GEMINI_COMPLETION_MODEL;
export const GEMINI_COMPLETION_FALLBACK_MODELS = [
    DEFAULT_GEMINI_COMPLETION_MODEL,
    "gemini-2.0-flash",
    "gemini-1.5-flash",
] as const;

const DEFAULT_FALLBACK_OPENAI_IMAGE_MODEL = "gpt-image-1.5" as const;
export const DEFAULT_OPENAI_IMAGE_MODEL =
    process.env.DEFAULT_OPENAI_IMAGE_MODEL || DEFAULT_FALLBACK_OPENAI_IMAGE_MODEL;

const DEFAULT_FALLBACK_GEMINI_IMAGE_MODEL = "gemini-2.0-flash-preview-image-generation" as const;
export const DEFAULT_GEMINI_IMAGE_MODEL =
    process.env.DEFAULT_GEMINI_IMAGE_MODEL || DEFAULT_FALLBACK_GEMINI_IMAGE_MODEL;

export const DEFAULT_LOCAL_ENDPOINT = "http://localhost:8080/v1" as const;
export const DEFAULT_GEMINI_OPENAI_COMPAT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai" as const;

export function normalizeProvider(provider: string | undefined): KnownProvider {
    return provider === "gemini" ? "gemini" : "openai";
}

export function defaultCompletionModelForProvider(provider: KnownProvider): string {
    if (provider === "gemini") {
        return DEFAULT_GEMINI_COMPLETION_MODEL;
    }
    return DEFAULT_OPENAI_COMPLETION_MODEL;
}

export function defaultImageModelForProvider(provider: KnownProvider): string {
    if (provider === "gemini") {
        return DEFAULT_GEMINI_IMAGE_MODEL;
    }
    return DEFAULT_OPENAI_IMAGE_MODEL;
}

export function defaultEndpointForProvider(provider: KnownProvider): string | undefined {
    if (provider === "gemini") {
        return DEFAULT_GEMINI_OPENAI_COMPAT_ENDPOINT;
    }
    return undefined;
}

export function providerAPIKeyEnvVar(provider: KnownProvider): string {
    return provider === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
}

export function apiKeyNotSetErrorForProvider(provider: KnownProvider): string {
    if (provider === "gemini") {
        return `[ERROR] GEMINI_API_KEY environment variable not set.
Step 1) Go to https://aistudio.google.com/app/apikey to get an API key.
Step 2) Open the file .env in the root of this project, and add the following line, without the angle brackets:
GEMINI_API_KEY=<your API key>`;
    }
    return OPENAI_API_KEY_NOT_SET_ERROR;
}

// TODO: unit/integration test that this is returned as stderr when the API key is invalid/missing
export const OPENAI_API_KEY_NOT_SET_ERROR = `[ERROR] OPENAI_API_KEY environment variable not set.
Step 1) Go to https://beta.openai.com/account/api-keys to get an API key.
Step 2) Open the file .env in the root of this project, and add the following line, without the angle brackets:
OPENAI_API_KEY=<your API key>` as const;
