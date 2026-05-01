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
import OpenAI from "openai";
import {debugData, getFileContents} from "../../utils";
import {zodErrorToMessage} from "../../utils";
import {
    OpenAIImageCLIOptions,
    OpenAIImageCLIOptionsLOCAL,
    openaiImageCLIOptionsSchema,
    defaultFileExtensionForImageFormat,
} from "./validation";
import concatenateImagePromptPieces from "./concatenatePromptPieces";
import OpenAICommand from "../../OpenAICommand";
import openaiImageCLIParser from "./cliParser";
import {deriveImageOutputPaths} from "./outputPaths";

import type commander from "commander";
import fs from "fs";
import path from "path";
import util from "util";

const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

/** GPT Image models accept much longer prompts than legacy DALL·E 2. */
const MAX_GPT_IMAGE_PROMPT_LENGTH = 32000;

export default class OpenAIImageCommand extends OpenAICommand<OpenAIImageCLIOptions> {
    static className = "OpenAIImageCommand";

    static subCommandName = "openai-image";
    static aliases = ["image", "openai-img", "img"];

    static description =
        "Generate images with OpenAI GPT Image models (Image API: gpt-image-1.5, gpt-image-1, gpt-image-1-mini)";
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
        return openaiImageCLIParser(basicCommand, scriptContext);
    }

    async fetchAdditionalData(): Promise<Partial<OpenAIImageCLIOptions> | FetchAdditionalDataError> {
        const {scriptContext} = this.ctx;

        if (!scriptContext.isRemote) {
            const optsDelta: Partial<OpenAIImageCLIOptionsLOCAL> = {};
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

    verifyCLI(optsDelta: Partial<OpenAIImageCLIOptions>): OpenAIImageCLIOptions | VerifyCLIError {
        const {unverifiedSubCommandOpts} = this.ctx;

        const merged: Record<string, unknown> = {
            ...unverifiedSubCommandOpts,
            ...optsDelta,
        };
        const fullUnverifiedSubCommandOpts =
            merged.prompt != null && merged.promptFlag == null
                ? {...merged, promptFlag: merged.prompt}
                : merged;

        const parsed = openaiImageCLIOptionsSchema.safeParse(
            fullUnverifiedSubCommandOpts
        );
        if (!parsed.success) {
            return new VerifyCLIError(
                zodErrorToMessage(parsed.error)
            );
        }
        return parsed.data;
    }

    async callAPI(
        verifiedOpts: OpenAIImageCLIOptions
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

        const prompt = concatenateImagePromptPieces(
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
                `[ERROR] Image prompt must be at most ${MAX_GPT_IMAGE_PROMPT_LENGTH} characters (got ${prompt.length}).`
            );
        }

        const provider = this.getProvider(verifiedOpts);
        const apiKeyOrErr = this.getAPIKey(provider);
        if (apiKeyOrErr instanceof APIKeyNotSetError) {
            return apiKeyOrErr;
        }
        const apiKey = apiKeyOrErr;

        const baseURL = this.resolveBaseURL(
            provider,
            "endpoint" in verifiedOpts ? verifiedOpts.endpoint : undefined,
            "local" in verifiedOpts ? verifiedOpts.local : undefined,
        );

        const client = new OpenAI({apiKey, baseURL});

        const {topLevelCommandOpts} = this.ctx;
        const {debug} = topLevelCommandOpts;

        const defaultExt = defaultFileExtensionForImageFormat(verifiedOpts.outputFormat);

        let imageResponse;
        try {
            imageResponse = await client.images.generate({
                model: verifiedOpts.model,
                prompt,
                n: verifiedOpts.repeat,
                size: verifiedOpts.size,
                quality: verifiedOpts.quality,
                output_format: verifiedOpts.outputFormat,
                user: verifiedOpts.user,
            });
        } catch (e: any) {
            debug && (await debugData("openaiImageError", e));
            const message = this.sanitizeAndFormatOpenAIAPIError(e, apiKey);
            return new KnownSafeRunError(message);
        }

        debug && debugData("openaiImage", imageResponse);

        const items = imageResponse.data;
        if (!items || items.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No images returned from the API."
            );
        }

        const initialCwd =
            "initialCwd" in scriptContext
                ? scriptContext.initialCwd
                : process.cwd();
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
                className: OpenAIImageCommand.className,
                service: provider,
                command: "image",
                model: verifiedOpts.model,
            },
            output,
        };

        return success;
    }
}
