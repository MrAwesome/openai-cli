// Path: validation.ts
//
import {z} from "zod";
import {
    DEFAULT_OPENAI_REMOTE_USER,
} from "../../defaultSettings";
import {jsonSchema} from "../../utils";

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
export const openaiCompletionCLIOptionsREMOTESchema = z
    .object({
        model: z.string().default("text-davinci-003"),
        temperature: z.number().default(0.6),
        maxTokens: z.number().default(1024),
        repeat: z.number().default(1),
        echo: z.boolean().default(false),
        stop: z.string().nullable().optional(),
        logitBias: z.record(jsonSchema).nullable().optional(),
        bestOf: z.number().default(1),
        topP: z.number().default(1.0),
        frequencyPenalty: z.number().default(0.0),
        presencePenalty: z.number().default(0.0),
        promptJoiner: z.string().default("\n"),
        promptFlag: z.string().optional(),
        promptSuffix: z.string().optional(),
        promptPrefix: z.string().optional(),
        suffix: z.string().nullable().optional(),
        trailingNewline: z.boolean().default(true),
        joiner: z.boolean().default(false),

        // <FORCED FALSE UNSAFE>
        // TODO: have -u be a part of scriptcontext - unix user, or arg passed in by calling library
        user: z.literal(DEFAULT_OPENAI_REMOTE_USER).default(DEFAULT_OPENAI_REMOTE_USER),
        stream: z.literal(false).default(false),
        promptFile: z.undefined().optional(),
        // </FORCED FALSE UNSAFE>

        // Unused, as they don't add anything to the functionality of a CLI:
        //logprobs: z.number().nullable().optional(),
    })
    .strip();

export const openaiCompletionCLIOptionsLOCALSchema =
    openaiCompletionCLIOptionsREMOTESchema
        .extend({
            _local_UNSAFE: z.literal(true).default(true),
            user: z.string().optional().default(process.env.USER ?? "unknown-local-script-user"),
            stream: z.boolean().optional().default(false),
            promptFile: z.string().optional(),
        })
        .strip();

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
        max_tokens: z.number().optional(),
        temperature: z.number().optional(),
        top_p: z.number().optional(),
        n: z.number().optional(),
        stream: z.boolean().optional(),
        echo: z.boolean().optional(),
        stop: z.string().nullable().optional(),
        presence_penalty: z.number().optional(),
        frequency_penalty: z.number().optional(),
        best_of: z.number().optional(),
        logit_bias: z.record(jsonSchema).nullable().optional(),
        user: z.string().optional(),

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
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        top_p: opts.topP,
        n: opts.repeat,
        stream: opts.stream,
        echo: opts.echo,
        stop: opts.stop,
        presence_penalty: opts.presencePenalty,
        frequency_penalty: opts.frequencyPenalty,
        best_of: opts.bestOf,
        logit_bias: opts.logitBias,
        user: opts.user,
    };

    return output;
}
