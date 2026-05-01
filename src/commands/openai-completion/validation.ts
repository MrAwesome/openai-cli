import {z} from "zod";
import {
    DEFAULT_PROVIDER,
    DEFAULT_REMOTE_USER,
    DEFAULT_LOCAL_ENDPOINT,
    defaultCompletionModelForProvider,
    KNOWN_PROVIDERS,
    normalizeProvider,
} from "../../defaultSettings";

/** Matches OpenAI Chat Completions `reasoning_effort` and Gemini OpenAI-compat mapping. */
export const REASONING_EFFORT_VALUES = [
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
] as const;

export type ReasoningEffortCLI = (typeof REASONING_EFFORT_VALUES)[number];

// The zod config for the openai completion command. This is specifically
// for the CLI options, not the API options. We do the transformation from
// this object to the API object below, for openaiCompletionAPIOptionsSchema.
// The reason for this discrepancy is to allow us to create CLI-specific options
// such as 'trailingNewline', as well as to have more human-readable names for the options
// (e.g. 'repeat' instead of 'n').
//
// We don't enforce numerical boundaries (e.g. frequencyPenalty must be between -2 and 2)
// because the OpenAI API/library will do that for us.
//
// NOTE: these are camelCase because that's what commander will generate
const openaiCompletionCLIOptionsSchemaBase = z
    .object({
        provider: z.enum(KNOWN_PROVIDERS).default(DEFAULT_PROVIDER),
        model: z.string().optional(),
        temperature: z.number().default(1),
        maxTokens: z.number().default(16384),
        repeat: z.number().default(1),
        stop: z.string().nullable().optional(),
        logitBias: z.record(z.string(), z.number()).nullable().optional(),
        topP: z.number().default(1.0),
        frequencyPenalty: z.number().default(0.0),
        presencePenalty: z.number().default(0.0),
        promptJoiner: z.string().default("\n"),
        promptFlag: z.string().optional(),
        promptSuffix: z.string().optional(),
        promptPrefix: z.string().optional(),
        suffix: z.string().nullable().optional(),
        system: z.string().optional(),
        /** OpenAI: reasoning_effort. Gemini (OpenAI compat): maps to thinking_level / thinking_budget. */
        reasoning: z.enum(REASONING_EFFORT_VALUES).optional(),
        trailingNewline: z.boolean().default(true),
        joiner: z.boolean().default(false),
        trim: z.boolean().default(true),

        // <FORCED FALSE UNSAFE>
        // TODO: have -u be a part of scriptcontext - unix user, or arg passed in by calling library
        user: z.literal(DEFAULT_REMOTE_USER).default(DEFAULT_REMOTE_USER),
        stream: z.literal(false).default(false),
        promptFile: z.undefined().optional(),
        // </FORCED FALSE UNSAFE>

        // Unused, as they don't add anything to the functionality of a CLI:
        //logprobs: z.number().nullable().optional(),
    })
    .strip();

export const openaiCompletionCLIOptionsREMOTESchema =
    openaiCompletionCLIOptionsSchemaBase
        .transform((opts) => ({
            ...opts,
            model: opts.model ?? defaultCompletionModelForProvider(normalizeProvider(opts.provider)),
        }));

export const openaiCompletionCLIOptionsLOCALSchema =
    openaiCompletionCLIOptionsSchemaBase
        .extend({
            _local_UNSAFE: z.literal(true).default(true),
            user: z.string().optional().default(process.env.USER ?? "unknown-local-script-user"),
            stream: z.boolean().optional().default(false),
            promptFile: z.string().optional(),
            stdinText: z.string().optional(),
            imagePaths: z.array(z.string()).default([]),
            endpoint: z.preprocess(
                (val) => (val === "local" ? DEFAULT_LOCAL_ENDPOINT : val),
                z.string().url().optional()
            ),
            local: z.boolean().optional(),
        })
        .strip()
        .transform((opts) => ({
            ...opts,
            model: opts.model ?? defaultCompletionModelForProvider(normalizeProvider(opts.provider)),
        }));

export type OpenAICompletionCLIOptionsLOCAL = z.infer<typeof openaiCompletionCLIOptionsLOCALSchema>;

export const openaiCompletionCLIOptionsREMOTESchemaDefaults = openaiCompletionCLIOptionsREMOTESchema.parse({});
export const openaiCompletionCLIOptionsLOCALSchemaDefaults = openaiCompletionCLIOptionsLOCALSchema.parse({});


export const openaiCompletionCLIOptionsSchema =
    openaiCompletionCLIOptionsLOCALSchema.or(
        openaiCompletionCLIOptionsREMOTESchema
    );

export type OpenAICompletionCLIOptions = z.infer<
    typeof openaiCompletionCLIOptionsSchema
>;

// NOTE: these are snake_case because that's what the openai API expects.
const openAICompletionAPIOptionsSchema = z
    .object({
        model: z.string(),
        prompt: z.string().optional(),
        max_completion_tokens: z.number().optional(),
        temperature: z.number().optional(),
        top_p: z.number().optional(),
        n: z.number().optional(),
        stream: z.boolean().optional(),
        stop: z.string().nullable().optional(),
        presence_penalty: z.number().optional(),
        frequency_penalty: z.number().optional(),
        logit_bias: z.record(z.string(), z.number()).nullable().optional(),
        user: z.string().optional(),
        reasoning_effort: z.enum(REASONING_EFFORT_VALUES).optional(),

        // Unused, as they don't add anything to the functionality of a CLI:
        //logprobs: z.number().optional(),
    })
    .strip();

export type OpenAICompletionAPIOptions = z.infer<
    typeof openAICompletionAPIOptionsSchema
>;

export function convertOpenAICompletionCLIOptionsToAPIOptions(
    opts: OpenAICompletionCLIOptions,
    prompt: string,
): OpenAICompletionAPIOptions {
    const output: OpenAICompletionAPIOptions = {
        model: opts.model,
        prompt: prompt,
        max_completion_tokens: opts.maxTokens,
        temperature: opts.temperature,
        top_p: opts.topP,
        n: opts.repeat,
        stream: opts.stream,
        stop: opts.stop,
        presence_penalty: opts.presencePenalty,
        frequency_penalty: opts.frequencyPenalty,
        logit_bias: opts.logitBias,
        user: opts.user,
    };

    if (opts.reasoning !== undefined) {
        output.reasoning_effort = opts.reasoning;
    }

    return output;
}
