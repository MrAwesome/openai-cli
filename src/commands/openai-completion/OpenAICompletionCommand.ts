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
import {AxiosResponse} from "axios";
import {Configuration, CreateChatCompletionResponse, CreateCompletionResponse, OpenAIApi} from "openai";
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
import {isChatCompletionModel, convertCompletionRequestToChatCompletionRequest} from "./ChatCompletionTools";
import {DEFAULT_LOCAL_ENDPOINT} from "../../defaultSettings";

export default class OpenAICompletionCommand extends OpenAICommand<OpenAICompletionCLIOptions> {
    static className = "OpenAICompletionCommand";

    static subCommandName = "openai-completion";
    static aliases = ["complete", "openai-complete", "completion"];

    static description = "Generate text using OpenAI's Completion API";
    static showHelpOnEmptyArgsAndOptions = true;

    constructor(protected ctx: SubCommandContext) {
        super();
        this.run = this.run.bind(this);
        this.fetchAdditionalData = this.fetchAdditionalData.bind(this);
        this.verifyCLI = this.verifyCLI.bind(this);
        this.callAPI = this.callAPI.bind(this);
        this.callCompletionAPI = this.callCompletionAPI.bind(this);
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
        const fullcommand = openaiCompletionCLIParser(
            basicCommand,
            scriptContext
        );

        return fullcommand;
    }

    // TODO: create integration tests
    async fetchAdditionalData(): Promise<Partial<OpenAICompletionCLIOptions> | FetchAdditionalDataError> {
        const {scriptContext} = this.ctx;

        if (!scriptContext.isRemote) {
            const optsDelta: Partial<OpenAICompletionCLIOptionsLOCAL> = {};
            // If this is false, we're likely being passed something on STDIN
            if (!process.stdin.isTTY) {
                let stdinText: string = "";
                process.stdin.setEncoding('utf8');
                for await (const chunk of process.stdin) {
                    stdinText += chunk;
                }
                optsDelta.stdinText = stdinText;
            }
            return optsDelta;
        } else {
            return {};
        }

    }

    verifyCLI(optsDelta: Partial<OpenAICompletionCLIOptions>): OpenAICompletionCLIOptions | VerifyCLIError {
        const {unverifiedSubCommandOpts} = this.ctx;

        const fullUnverifiedSubCommandOpts = {...unverifiedSubCommandOpts, ...optsDelta};

        const openaiCompletionOptsOrErr =
            openaiCompletionCLIOptionsSchema.safeParse(
                fullUnverifiedSubCommandOpts
            );
        if (!openaiCompletionOptsOrErr.success) {
            return new VerifyCLIError(
                zodErrorToMessage(openaiCompletionOptsOrErr.error)
            );
        }
        const openaiCompletionCLIOpts = openaiCompletionOptsOrErr.data;

        return openaiCompletionCLIOpts;
    }

    async callAPI(
        verifiedOpts: OpenAICompletionCLIOptions
    ): Promise<ScriptReturn | KnownSafeRunError> {
        // check if we're in CLI mode, and if so, set scriptContext.isCLI
        const {
            subCommandArgs,
            scriptContext,
        } = this.ctx;

        // If 'promptFile' is set, read the file here and set 'promptFileContents' to the file contents
        const {promptFile} = verifiedOpts;
        let promptFileContents: string | undefined;

        // These will only be truthy/present in local runs, by design.
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

        let basePath = undefined;
        if ("endpoint" in verifiedOpts) {
            const {endpoint} = verifiedOpts;
            basePath = endpoint;
        } else if ("local" in verifiedOpts && verifiedOpts.local) {
            basePath = DEFAULT_LOCAL_ENDPOINT;
        }

        // NOTE: Despite the API options all being snake_case, the node client uses "apiKey"
        const configuration = new Configuration({apiKey, basePath});
        const openai = new OpenAIApi(configuration);

        // TODO: ensure these args are typed correctly
        const apiOptions = convertOpenAICompletionCLIOptionsToAPIOptions(verifiedOpts, prompt);
        const {model} = apiOptions;

        let output: string | KnownSafeRunError;
        if (isChatCompletionModel(model)) {
            output = await this.callChatCompletionAPI(openai, apiOptions, apiKey, verifiedOpts.system);
        } else {
            output = await this.callCompletionAPI(openai, apiOptions, apiKey);
        }

        if (output instanceof KnownSafeRunError) {
            return output;
        }

        if (output.trim() === "") {
            return new KnownSafeRunError("[ERROR] No text returned.");
        }

        // TODO: check that completionResponse is safe to display remotely, or if it contains api key
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

    private async callCompletionAPI(
        openai: OpenAIApi,
        apiOptions: OpenAICompletionAPIOptions,
        apiKey: string,
    ): Promise<string | KnownSafeRunError> {
        const {topLevelCommandOpts} = this.ctx;
        const {debug} = topLevelCommandOpts;

        let completionResponse: AxiosResponse<CreateCompletionResponse, any>;
        try {
            completionResponse = await openai.createCompletion(apiOptions);
        } catch (e: any) {
            debug && (await debugData("openaiCompletionError", e));
            const message = this.sanitizeAndFormatOpenAIAPIError(e, apiKey);
            return new KnownSafeRunError(message);
        }

        debug && debugData("openaiCompletion", completionResponse);

        const completionChoices = completionResponse.data.choices;

        // TODO: more generalized error handling
        if (completionChoices.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No choices returned from the API."
            );
        }

        // TODO: implement -x conditional trim() here
        //const {trim} = verifiedOpts;

        let output = "";
        if (completionChoices.length > 1) {
            completionChoices.forEach((choice, _i) => {
                // Labeled numbered list:
                //output += `${i + 1}. ${choice.text?.trim()}\n`;
                output += `${choice.text}\n`;
            });
        } else {
            // TODO: implement -x conditional trim() here
            output = completionChoices[0].text ?? "";
        }

        return output;
    }

    private async callChatCompletionAPI(
        openai: OpenAIApi,
        apiOptions: OpenAICompletionAPIOptions,
        apiKey: string,
        system?: string,
    ): Promise<string | KnownSafeRunError> {
        const {topLevelCommandOpts} = this.ctx;
        const {debug} = topLevelCommandOpts;

        let completionResponse: AxiosResponse<CreateChatCompletionResponse, any>;

        const chatAPIOptions = convertCompletionRequestToChatCompletionRequest(apiOptions, system);

        try {
            completionResponse = await openai.createChatCompletion(chatAPIOptions);
        } catch (e: any) {
            debug && (await debugData("openaiCompletionError", e));
            const message = this.sanitizeAndFormatOpenAIAPIError(e, apiKey);
            return new KnownSafeRunError(message);
        }

        debug && debugData("openaiCompletion", completionResponse);

        const completionChoices = completionResponse.data.choices;

        // TODO: more generalized error handling
        if (completionChoices.length === 0) {
            return new KnownSafeRunError(
                "[ERROR] No choices returned from the API."
            );
        }

        // TODO: implement -x conditional trim() here
        //const {trim} = verifiedOpts;

        let output = "";
        if (completionChoices.length > 1) {
            completionChoices.forEach((choice, _i) => {
                // Labeled numbered list:
                //output += `${i + 1}. ${choice.text?.trim()}\n`;
                output += `${choice.message?.content ?? ""}\n`;
            });
        } else {
            // TODO: implement -x conditional trim() here
            output = completionChoices[0].message?.content ?? "";
        }

        return output;
    }
}
