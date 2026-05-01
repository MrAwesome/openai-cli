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
import type {
    ChatCompletion,
    ChatCompletionContentPart,
} from "openai/resources/chat/completions";
import {
    debugData,
    getFileContents,
    inferImageMimeTypeFromMagicBytes,
    readBinaryFile,
} from "../../utils";
import {zodErrorToMessage} from "../../utils";
import {
    OpenAICompletionCLIOptions,
    openaiCompletionCLIOptionsSchema,
    convertOpenAICompletionCLIOptionsToAPIOptions,
    OpenAICompletionCLIOptionsLOCAL,
    OpenAICompletionAPIOptions
} from "./validation";
import concatenatePromptPieces from "./concatenatePromptPieces";
import OpenAICommand from "../../OpenAICommand";
import openaiCompletionCLIParser from "./cliParser";

import type commander from "commander";
import {convertCompletionRequestToChatCompletionRequest} from "./ChatCompletionTools";
import {choiceToTextOrError} from "./extractAssistantText";
import type {KnownProvider} from "../../defaultSettings";
import {GEMINI_COMPLETION_FALLBACK_MODELS} from "../../defaultSettings";

export default class OpenAICompletionCommand extends OpenAICommand<OpenAICompletionCLIOptions> {
    static className = "OpenAICompletionCommand";

    static subCommandName = "openai-completion";
    static aliases = ["complete", "openai-complete", "completion"];

    static description = "Generate text using OpenAI's Chat Completions API";
    static showHelpOnEmptyArgsAndOptions = true;

    constructor(protected ctx: SubCommandContext) {
        super();
        this.run = this.run.bind(this);
        this.fetchAdditionalData = this.fetchAdditionalData.bind(this);
        this.verifyCLI = this.verifyCLI.bind(this);
        this.callAPI = this.callAPI.bind(this);
        this.callChatCompletionAPI = this.callChatCompletionAPI.bind(this);
    }

    static addSubCommandTo(
        program: commander.Command,
        scriptContext: ScriptContext
    ): commander.Command {
        const basicCommand = program
            .command(this.subCommandName)
            .aliases(this.aliases)
            .description(this.description);
        return openaiCompletionCLIParser(
            basicCommand,
            scriptContext
        );
    }

    async fetchAdditionalData(): Promise<Partial<OpenAICompletionCLIOptions> | FetchAdditionalDataError> {
        const {scriptContext} = this.ctx;

        if (!scriptContext.isRemote) {
            const optsDelta: Partial<OpenAICompletionCLIOptionsLOCAL> = {};
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

    verifyCLI(optsDelta: Partial<OpenAICompletionCLIOptions>): OpenAICompletionCLIOptions | VerifyCLIError {
        const {unverifiedSubCommandOpts} = this.ctx;

        const merged: Record<string, unknown> = {
            ...unverifiedSubCommandOpts,
            ...optsDelta,
        };
        let normalized = merged.prompt != null && merged.promptFlag == null
            ? {...merged, promptFlag: merged.prompt}
            : merged;
        if ("image" in normalized) {
            const ir = normalized.image;
            normalized = {
                ...normalized,
                imagePaths: Array.isArray(ir) ? ir : [],
            };
            delete (normalized as Record<string, unknown>).image;
        }

        const fullUnverifiedSubCommandOpts = normalized;

        const openaiCompletionOptsOrErr =
            openaiCompletionCLIOptionsSchema.safeParse(
                fullUnverifiedSubCommandOpts
            );
        if (!openaiCompletionOptsOrErr.success) {
            return new VerifyCLIError(
                zodErrorToMessage(openaiCompletionOptsOrErr.error)
            );
        }
        return openaiCompletionOptsOrErr.data;
    }

    async callAPI(
        verifiedOpts: OpenAICompletionCLIOptions
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

        const prompt = concatenatePromptPieces(subCommandArgs, verifiedOpts, promptFileContents);

        const imagePaths =
            "imagePaths" in verifiedOpts ? verifiedOpts.imagePaths : [];

        if (prompt.length === 0) {
            if (imagePaths.length > 0) {
                return new KnownSafeRunError(
                    "[ERROR] Provide prompt text when using --image."
                );
            }
            return new KnownSafeRunError(
                "[ERROR] No prompt text was provided."
            );
        }

        let userContent: string | ChatCompletionContentPart[] | undefined;
        if (imagePaths.length > 0) {
            if (!("initialCwd" in scriptContext)) {
                return new KnownSafeRunError(
                    "[ERROR] --image requires a local run with a working directory."
                );
            }
            const parts: ChatCompletionContentPart[] = [
                {type: "text", text: prompt},
            ];
            for (const rel of imagePaths) {
                const buf = await readBinaryFile(scriptContext.initialCwd, rel);
                const mime = inferImageMimeTypeFromMagicBytes(buf);
                if (mime === null) {
                    return new KnownSafeRunError(
                        `[ERROR] Unrecognized image format (by magic bytes): ${rel}`
                    );
                }
                parts.push({
                    type: "image_url",
                    image_url: {
                        url: `data:${mime};base64,${buf.toString("base64")}`,
                        detail: "auto",
                    },
                });
            }
            userContent = parts;
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

        const apiOptions = convertOpenAICompletionCLIOptionsToAPIOptions(verifiedOpts, prompt);
        const modelWasExplicitlyProvided = this.ctx.unverifiedSubCommandOpts.model !== undefined;
        const modelCandidates = provider === "gemini" && !modelWasExplicitlyProvided
            ? Array.from(new Set([
                apiOptions.model,
                ...GEMINI_COMPLETION_FALLBACK_MODELS,
            ]))
            : [apiOptions.model];

        let output: string | KnownSafeRunError = new KnownSafeRunError("[ERROR] No completion model candidates were available.");
        let model = apiOptions.model;
        for (const candidateModel of modelCandidates) {
            const apiOptionsForModel: OpenAICompletionAPIOptions = {
                ...apiOptions,
                model: candidateModel,
            };
            const out = await this.callChatCompletionAPI(
                client,
                apiOptionsForModel,
                apiKey,
                provider,
                verifiedOpts.system,
                userContent,
            );
            if (!(out instanceof KnownSafeRunError)) {
                output = out;
                model = candidateModel;
                break;
            }
            output = out;
        }

        if (output instanceof KnownSafeRunError) {
            return output;
        }

        if (output.trim() === "") {
            return new KnownSafeRunError("[ERROR] No text returned.");
        }

        const success: ScriptSuccess = {
            status: "success",
            exitCode: 0,
            commandContext: {
                className: OpenAICompletionCommand.className,
                service: provider,
                command: "completion",
                model,
            },
            output,
        };

        return success;
    }

    private async callChatCompletionAPI(
        client: OpenAI,
        apiOptions: OpenAICompletionAPIOptions,
        apiKey: string,
        provider: KnownProvider,
        system?: string,
        userContent?: string | ChatCompletionContentPart[],
    ): Promise<string | KnownSafeRunError> {
        const {topLevelCommandOpts} = this.ctx;
        const {debug} = topLevelCommandOpts;

        const chatAPIOptions = convertCompletionRequestToChatCompletionRequest(
            apiOptions,
            system,
            userContent,
            provider,
        );

        let completionResponse: ChatCompletion;
        try {
            completionResponse = await client.chat.completions.create({
                ...chatAPIOptions,
                stream: false,
            });
        } catch (e: any) {
            debug && (await debugData("openaiCompletionError", e));
            const message = this.sanitizeAndFormatOpenAIAPIError(e, apiKey);
            return new KnownSafeRunError(message);
        }

        debug && debugData("openaiCompletion", completionResponse);

        const completionChoices = completionResponse.choices;

        if (completionChoices.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No choices returned from the API."
            );
        }

        let output = "";
        if (completionChoices.length > 1) {
            for (const choice of completionChoices) {
                const part = choiceToTextOrError(choice);
                if (!part.ok) {
                    return new KnownSafeRunError(part.error);
                }
                output += `${part.text}\n`;
            }
        } else {
            const part = choiceToTextOrError(completionChoices[0]);
            if (!part.ok) {
                return new KnownSafeRunError(part.error);
            }
            output = part.text;
        }

        return output;
    }
}
