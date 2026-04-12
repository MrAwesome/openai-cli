import {
    ScriptReturn,
    SubCommandContext,
    VerifyCLIError,
    KnownSafeRunError,
    APIKeyNotSetError,
    ScriptContext,
    FetchAdditionalDataError,
    ScriptSuccess,
} from "../../types";
import {debugData, getFileContents, resolvePathUnderInitialCwd} from "../../utils";
import {zodErrorToMessage} from "../../utils";
import {
    OpenAIImageEditCLIOptions,
    openaiImageEditCLIOptionsSchema,
    defaultFileExtensionForImageFormat,
} from "./validation";
import concatenateImageEditPromptPieces from "./concatenatePromptPieces";
import OpenAICommand from "../../OpenAICommand";
import openaiImageEditCLIParser from "./cliParser";
import {deriveImageOutputPaths} from "../openai-image/outputPaths";
import {DEFAULT_LOCAL_ENDPOINT} from "../../defaultSettings";

import type commander from "commander";
import {readFile} from "node:fs/promises";
import fs from "fs";
import path from "path";
import util from "util";

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

const MAX_GPT_IMAGE_PROMPT_LENGTH = 32000;

function blobMimeHintForPath(filePath: string): string | undefined {
    switch (path.extname(filePath).toLowerCase()) {
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".webp":
            return "image/webp";
        case ".gif":
            return "image/gif";
        default:
            return undefined;
    }
}

async function readPathAsImageBlob(absPath: string): Promise<Blob> {
    const buf = await readFile(absPath);
    const t = blobMimeHintForPath(absPath);
    return new Blob([buf], t ? {type: t} : {});
}

/** Parsed JSON from POST /v1/images/edits (enough for our write path). */
interface ImageEditHttpResponse {
    data?: Array<{b64_json?: string}>;
    output_format?: "png" | "jpeg" | "webp";
}

export default class OpenAIImageEditCommand extends OpenAICommand<OpenAIImageEditCLIOptions> {
    static className = "OpenAIImageEditCommand";

    static subCommandName = "openai-image-edit";
    static aliases = ["edit", "image-edit", "img-edit"];

    static description =
        "Edit or extend images with OpenAI GPT Image models (Images API edit endpoint; use -i for each input file, up to 16)";
    static showHelpOnEmptyArgsAndOptions = true;

    constructor(protected ctx: SubCommandContext) {
        super();
        this.run = this.run.bind(this);
        this.fetchAdditionalData = this.fetchAdditionalData.bind(this);
        this.verifyCLI = this.verifyCLI.bind(this);
        this.callAPI = this.callAPI.bind(this);
    }

    static addSubCommandTo(
        program: commander.Command,
        scriptContext: ScriptContext
    ): commander.Command {
        const basicCommand = program
            .command(this.subCommandName)
            .aliases(this.aliases)
            .description(this.description);
        return openaiImageEditCLIParser(
            basicCommand,
            scriptContext
        );
    }

    async fetchAdditionalData(): Promise<Partial<OpenAIImageEditCLIOptions> | FetchAdditionalDataError> {
        const {scriptContext} = this.ctx;

        if (!scriptContext.isRemote) {
            const optsDelta: Partial<OpenAIImageEditCLIOptions> = {};
            if (!process.stdin.isTTY) {
                let stdinText: string = "";
                process.stdin.setEncoding("utf8");
                for await (const chunk of process.stdin) {
                    stdinText += chunk;
                }
                optsDelta.stdinText = stdinText;
            }
            return optsDelta;
        }
        return {};
    }

    verifyCLI(optsDelta: Partial<OpenAIImageEditCLIOptions>): OpenAIImageEditCLIOptions | VerifyCLIError {
        if (this.ctx.scriptContext.isRemote) {
            return new VerifyCLIError(
                "The image edit command is only available in local CLI mode (it requires -i / --image file paths)."
            );
        }

        const {unverifiedSubCommandOpts} = this.ctx;

        let merged: Record<string, unknown> = {
            ...unverifiedSubCommandOpts,
            ...optsDelta,
        };
        if (merged.prompt != null && merged.promptFlag == null) {
            merged = {...merged, promptFlag: merged.prompt};
        }
        if ("image" in merged) {
            const ir = merged.image;
            merged = {
                ...merged,
                imagePaths: Array.isArray(ir) ? ir : [],
            };
            delete merged.image;
        }

        const parsed = openaiImageEditCLIOptionsSchema.safeParse(merged);
        if (!parsed.success) {
            return new VerifyCLIError(
                zodErrorToMessage(parsed.error)
            );
        }
        return parsed.data;
    }

    async callAPI(
        verifiedOpts: OpenAIImageEditCLIOptions
    ): Promise<ScriptReturn | KnownSafeRunError> {
        const {
            subCommandArgs,
            scriptContext,
        } = this.ctx;

        const {promptFile} = verifiedOpts;
        let promptFileContents: string | undefined;

        if (promptFile && "initialCwd" in scriptContext) {
            promptFileContents =
                await getFileContents(scriptContext.initialCwd, promptFile);
        }

        const prompt = concatenateImageEditPromptPieces(
            subCommandArgs,
            verifiedOpts,
            promptFileContents
        );

        if (prompt.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No prompt text was provided."
            );
        }

        if (prompt.length > MAX_GPT_IMAGE_PROMPT_LENGTH) {
            return new KnownSafeRunError(
                `[ERROR] Image edit prompt must be at most ${MAX_GPT_IMAGE_PROMPT_LENGTH} characters (got ${prompt.length}).`
            );
        }

        const apiKeyOrErr = this.getAPIKey();
        if (apiKeyOrErr instanceof APIKeyNotSetError) {
            return apiKeyOrErr;
        }
        const apiKey = apiKeyOrErr;

        let baseURL: string | undefined;
        if ("endpoint" in verifiedOpts) {
            const {endpoint} = verifiedOpts;
            baseURL = endpoint;
        } else if ("local" in verifiedOpts && verifiedOpts.local) {
            baseURL = DEFAULT_LOCAL_ENDPOINT;
        }

        const {topLevelCommandOpts} = this.ctx;
        const {debug} = topLevelCommandOpts;

        if (!("initialCwd" in scriptContext)) {
            return new KnownSafeRunError(
                "[ERROR] initialCwd is required to resolve image paths."
            );
        }
        const {initialCwd} = scriptContext;

        const imageAbsPaths = verifiedOpts.imagePaths.map((rel) =>
            resolvePathUnderInitialCwd(initialCwd, rel)
        );

        let imageResponse: ImageEditHttpResponse;
        try {
            // Do not use `openai` `client.images.edit`: it always attaches
            // `stream: false` to the request options object, which some servers
            // surface as a multipart field `stream` and reject ("Unknown parameter").
            const form = new FormData();
            form.append("model", verifiedOpts.model);
            form.append("prompt", prompt);
            form.append("n", String(verifiedOpts.repeat));
            form.append("size", verifiedOpts.size);
            form.append("user", verifiedOpts.user);

            if (imageAbsPaths.length === 1) {
                const p = imageAbsPaths[0]!;
                form.append("image", await readPathAsImageBlob(p), path.basename(p));
            } else {
                for (const p of imageAbsPaths) {
                    form.append("image[]", await readPathAsImageBlob(p), path.basename(p));
                }
            }

            if (verifiedOpts.maskPath !== undefined) {
                const mp = resolvePathUnderInitialCwd(initialCwd, verifiedOpts.maskPath);
                form.append("mask", await readPathAsImageBlob(mp), path.basename(mp));
            }

            if (verifiedOpts.inputFidelity !== undefined) {
                form.append("input_fidelity", verifiedOpts.inputFidelity);
            }

            const root = (baseURL ?? "https://api.openai.com/v1").replace(/\/$/, "");
            const url = `${root}/images/edits`;

            const httpRes = await fetch(url, {
                method: "POST",
                headers: {Authorization: `Bearer ${apiKey}`},
                body: form,
            });

            const rawText = await httpRes.text();
            let parsed: unknown;
            try {
                parsed = rawText.length > 0 ? JSON.parse(rawText) : {};
            } catch {
                parsed = {};
            }

            if (!httpRes.ok) {
                const errBody = parsed as {error?: {message?: string}};
                const apiMsg =
                    errBody?.error?.message
                    ?? (rawText.length > 0 ? rawText : httpRes.statusText);
                throw new Error(apiMsg);
            }

            imageResponse = parsed as ImageEditHttpResponse;
        } catch (e: any) {
            debug && (await debugData("openaiImageEditError", e));
            const message = this.sanitizeAndFormatOpenAIAPIError(e, apiKey);
            return new KnownSafeRunError(message);
        }

        debug && debugData("openaiImageEdit", imageResponse);

        const items = imageResponse.data;
        if (!items || items.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No images returned from the API."
            );
        }

        const formatForFilename =
            imageResponse.output_format ?? verifiedOpts.outputFormat;
        const defaultExt = defaultFileExtensionForImageFormat(formatForFilename);

        const targetPaths = deriveImageOutputPaths(
            verifiedOpts.output,
            items.length,
            initialCwd,
            defaultExt
        );

        if (targetPaths.length !== items.length) {
            return new KnownSafeRunError(
                "[ERROR] Mismatch between requested image count and API response."
            );
        }

        for (let i = 0; i < items.length; i++) {
            const b64 = items[i].b64_json;
            if (b64 === undefined || b64.length === 0) {
                return new KnownSafeRunError(
                    "[ERROR] API did not return image data (b64_json). Check endpoint compatibility."
                );
            }
            const dest = targetPaths[i];
            await mkdir(path.dirname(dest), {recursive: true});
            const buf = Buffer.from(b64, "base64");
            await writeFile(dest, buf);
        }

        const lines = targetPaths.map((p) => `Wrote ${p}`);
        const output = lines.join("\n") + "\n";

        const success: ScriptSuccess = {
            status: "success",
            exitCode: 0,
            commandContext: {
                className: OpenAIImageEditCommand.className,
                service: "openai",
                command: "image-edit",
                model: verifiedOpts.model,
            },
            output,
        };

        return success;
    }
}
