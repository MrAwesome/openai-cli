import {z} from "zod";
import {
    DEFAULT_PROVIDER,
    DEFAULT_REMOTE_USER,
    DEFAULT_LOCAL_ENDPOINT,
    defaultImageModelForProvider,
    KNOWN_PROVIDERS,
    normalizeProvider,
} from "../../defaultSettings";

/** Map CLI-friendly aliases to API pixel dimensions (GPT Image models). */
export function normalizeGptImageCliSize(val: unknown): unknown {
    if (typeof val !== "string") {
        return val;
    }
    switch (val.toLowerCase()) {
        case "landscape":
            return "1536x1024";
        case "portrait":
            return "1024x1536";
        default:
            return val;
    }
}

/** Sizes supported for GPT Image models (Image API); landscape/portrait accepted as aliases. */
export const gptImageSizeSchema = z.preprocess(
    normalizeGptImageCliSize,
    z.enum(["auto", "1024x1024", "1536x1024", "1024x1536"]),
);

const imageQualitySchema = z.enum(["auto", "low", "medium", "high"]);

const outputFormatSchema = z.enum(["png", "jpeg", "webp"]);

const openaiImageCLIOptionsSchemaBase = z
    .object({
        provider: z.enum(KNOWN_PROVIDERS).default(DEFAULT_PROVIDER),
        model: z.string().optional(),
        repeat: z.number().int().min(1).max(10).default(1),
        size: gptImageSizeSchema.default("1024x1024"),
        quality: imageQualitySchema.default("auto"),
        outputFormat: outputFormatSchema.default("png"),
        output: z.string().default("image.png"),
        promptFlag: z.string().optional(),
        promptSuffix: z.string().optional(),
        promptPrefix: z.string().optional(),
        promptJoiner: z.string().default("\n"),
        joiner: z.boolean().default(false),
        trailingNewline: z.boolean().default(false),

        user: z.literal(DEFAULT_REMOTE_USER).default(DEFAULT_REMOTE_USER),
        promptFile: z.undefined().optional(),
    })
    .strip();

export const openaiImageCLIOptionsREMOTESchema =
    openaiImageCLIOptionsSchemaBase
        .transform((opts) => ({
            ...opts,
            model: opts.model ?? defaultImageModelForProvider(normalizeProvider(opts.provider)),
        }));

export const openaiImageCLIOptionsLOCALSchema =
    openaiImageCLIOptionsSchemaBase
        .extend({
            _local_UNSAFE: z.literal(true).default(true),
            user: z.string().optional().default(process.env.USER ?? "unknown-local-script-user"),
            promptFile: z.string().optional(),
            stdinText: z.string().optional(),
            endpoint: z.preprocess(
                (val) => (val === "local" ? DEFAULT_LOCAL_ENDPOINT : val),
                z.string().url().optional()
            ),
            local: z.boolean().optional(),
        })
        .strip()
        .transform((opts) => ({
            ...opts,
            model: opts.model ?? defaultImageModelForProvider(normalizeProvider(opts.provider)),
        }));

export type OpenAIImageCLIOptionsLOCAL = z.infer<typeof openaiImageCLIOptionsLOCALSchema>;

export const openaiImageCLIOptionsREMOTESchemaDefaults = openaiImageCLIOptionsREMOTESchema.parse({});
export const openaiImageCLIOptionsLOCALSchemaDefaults = openaiImageCLIOptionsLOCALSchema.parse({});

export const openaiImageCLIOptionsSchema =
    openaiImageCLIOptionsLOCALSchema.or(
        openaiImageCLIOptionsREMOTESchema
    );

export type OpenAIImageCLIOptions = z.infer<
    typeof openaiImageCLIOptionsSchema
>;

export function defaultFileExtensionForImageFormat(
    format: z.infer<typeof outputFormatSchema>,
): string {
    switch (format) {
        case "jpeg":
            return ".jpg";
        case "webp":
            return ".webp";
        default:
            return ".png";
    }
}
