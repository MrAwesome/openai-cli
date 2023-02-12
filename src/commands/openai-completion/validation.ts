import {z} from "zod";
import {DEFAULT_OPENAI_REMOTE_USER, OPENAI_COMPLETION_DEFAULTS} from "../../defaultSettings";
import {jsonSchema} from "../../utils";

// The zod config for the openai completion command. This is specifically
// for the CLI options, not the API options. We do the transformation from
// this object to the API object below, for openaiCompletionAPIOptionsSchema.
// The reason for this discrepancy is to allow us to create CLI-specific options
// such as 'trim', as well as to have more human-readable names for the options
// (e.g. 'repeat' instead of 'n').
//
// NOTE: these are snake_case because that's what the openai API expects.
export const openAICompletionCLIOptionsREMOTESchema = z.object({
    model: z.string().default(OPENAI_COMPLETION_DEFAULTS.model),
    trim: z.boolean().optional(), // TODO: unused
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
    repeat: z.number().optional(),
    echo: z.boolean().optional(),
    stop: z.string().nullable().optional(), // TODO: unused
    logit_bias: z.record(jsonSchema).nullable().optional(), // TODO: unused
    best_of: z.number().optional(), // TODO: unused
    top_p: z.number().optional(), // TODO: unused
    frequency_penalty: z.number().optional(), // TODO: unused
    presence_penalty: z.number().optional(), // TODO: unused
    prompt_flag: z.string().optional(), // TODO: unused
    prompt_suffix: z.string().optional(), // TODO: unused
    suffix: z.string().nullable().optional(), // TODO: unused

    // <FORCED FALSE UNSAFE>
    // TODO: have -u be a part of scriptcontext - unix user, or arg passed in by calling library
    user: z.literal(DEFAULT_OPENAI_REMOTE_USER), // TODO: unused
    stream: z.literal(false).optional(), // TODO: unused
    prompt_file: z.undefined().optional(), // TODO: unused
    // </FORCED FALSE UNSAFE>

    // Unused, as they don't add anything to the functionality of a CLI:
    //logprobs: z.number().nullable().optional(), // TODO: unused
}).strip();

export const openAICompletionCLIOptionsLOCALSchema = openAICompletionCLIOptionsREMOTESchema.extend({
    _local_UNSAFE: z.literal(true).default(true),
    user: z.string().optional(), // TODO: unused
    stream: z.boolean().optional(), // TODO: unused
    prompt_file: z.string().optional(), // TODO: unused
});

export const openAICompletionCLIOptionsSchema = openAICompletionCLIOptionsLOCALSchema.or(openAICompletionCLIOptionsREMOTESchema);

export type OpenAICompletionCLIOptions = z.infer<typeof openAICompletionCLIOptionsSchema>;

// TODO:
// repeat
// trim

export const openAICompletionAPIOptionsSchema = openAICompletionCLIOptionsLOCALSchema
.extend({prompt: z.string().nonempty()})
.transform(
    (opts, ctx) => {
        const n = opts.repeat;

        delete opts.repeat;
        delete opts.trim;
        delete opts.prompt_flag;
        delete opts.prompt_file;
        delete opts.prompt_suffix;
        //
        // TODO: check for -p and -f prompts here in a function (find out how to get them from the opts object)

        return {n, ...opts};
    }
);
