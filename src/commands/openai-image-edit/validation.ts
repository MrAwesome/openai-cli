import {z} from "zod";
import {
    DEFAULT_LOCAL_ENDPOINT,
    DEFAULT_OPENAI_IMAGE_MODEL,
} from "../../defaultSettings";

const gptImageModelSchema = z.enum(["gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"]);

function resolvedDefaultImageModel(): z.infer<typeof gptImageModelSchema> {
    const m = DEFAULT_OPENAI_IMAGE_MODEL;
    if (m === "gpt-image-1.5" || m === "gpt-image-1" || m === "gpt-image-1-mini") {
        return m;
    }
    return "gpt-image-1.5";
}

const gptImageSizeSchema = z.enum([
    "auto",
    "1024x1024",
    "1536x1024",
    "1024x1536",
]);

const outputFormatSchema = z.enum(["png", "jpeg", "webp"]);

const inputFidelitySchema = z.enum(["high", "low"]);

export const openaiImageEditCLIOptionsSchema = z
    .object({
        _local_UNSAFE: z.literal(true).default(true),
        model: gptImageModelSchema.default(resolvedDefaultImageModel()),
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
