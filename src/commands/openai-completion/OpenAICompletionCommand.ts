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
import type {ChatCompletion} from "openai/resources/chat/completions";
import {debugData, getFileContents} from "../../utils";
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
import {DEFAULT_LOCAL_ENDPOINT} from "../../defaultSettings";

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
        const fullUnverifiedSubCommandOpts =
            merged.prompt != null && merged.promptFlag == null
                ? {...merged, promptFlag: merged.prompt}
                : merged;

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

        if (prompt.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No prompt text was provided."
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

        const client = new OpenAI({apiKey, baseURL});

        const apiOptions = convertOpenAICompletionCLIOptionsToAPIOptions(verifiedOpts, prompt);
        const {model} = apiOptions;

        const output = await this.callChatCompletionAPI(
            client,
            apiOptions,
            apiKey,
            verifiedOpts.system,
        );

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
                service: "openai",
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
        system?: string,
    ): Promise<string | KnownSafeRunError> {
        const {topLevelCommandOpts} = this.ctx;
        const {debug} = topLevelCommandOpts;

        const chatAPIOptions = convertCompletionRequestToChatCompletionRequest(apiOptions, system);

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
