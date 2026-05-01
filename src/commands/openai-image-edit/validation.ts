import {z} from "zod";
import {
    DEFAULT_PROVIDER,
    DEFAULT_LOCAL_ENDPOINT,
    defaultImageModelForProvider,
    KNOWN_PROVIDERS,
    normalizeProvider,
} from "../../defaultSettings";
import {gptImageSizeSchema} from "../openai-image/validation";

const outputFormatSchema = z.enum(["png", "jpeg", "webp"]);

const inputFidelitySchema = z.enum(["high", "low"]);

export const openaiImageEditCLIOptionsSchema = z
    .object({
        _local_UNSAFE: z.literal(true).default(true),
        provider: z.enum(KNOWN_PROVIDERS).default(DEFAULT_PROVIDER),
        model: z.string().optional(),
        repeat: z.number().int().min(1).max(10).default(1),
        size: gptImageSizeSchema.default("1024x1024"),
        outputFormat: outputFormatSchema.default("png"),
        output: z.string().default("image.png"),
        promptFlag: z.string().optional(),
        promptSuffix: z.string().optional(),
        promptPrefix: z.string().optional(),
        promptJoiner: z.string().default("\n"),
        joiner: z.boolean().default(false),
        trailingNewline: z.boolean().default(false),

        user: z.string().optional().default(process.env.USER ?? "unknown-local-script-user"),
        promptFile: z.string().optional(),
        stdinText: z.string().optional(),
        endpoint: z.preprocess(
            (val) => (val === "local" ? DEFAULT_LOCAL_ENDPOINT : val),
            z.string().url().optional()
        ),
        local: z.boolean().optional(),

        imagePaths: z.array(z.string()).min(1),
        maskPath: z.string().optional(),
        inputFidelity: inputFidelitySchema.optional(),
    })
    .strip()
    .transform((opts) => ({
        ...opts,
        model: opts.model ?? defaultImageModelForProvider(normalizeProvider(opts.provider)),
    }))
    .superRefine((data, ctx) => {
        if (data.model === "gpt-image-1-mini" && data.inputFidelity !== undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "input_fidelity is not supported for gpt-image-1-mini",
                path: ["inputFidelity"],
            });
        }
    });

export type OpenAIImageEditCLIOptions = z.infer<typeof openaiImageEditCLIOptionsSchema>;

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
