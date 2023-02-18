import {
    ScriptReturn,
    SubCommandContext,
    VerifyCLIError,
    KnownSafeRunError,
    APIKeyNotSetError,
    ScriptContext,
} from "../../types";
import {AxiosResponse} from "axios";
import {Configuration, CreateCompletionResponse, OpenAIApi} from "openai";
import {debugData, getFileContents} from "../../utils";
import {zodErrorToMessage} from "../../utils";
import {
    OpenAICompletionCLIOptions,
    openaiCompletionCLIOptionsSchema,
    convertOpenAICompletionCLIOptionsToAPIOptions
} from "./validation";
import concatenatePromptPieces from "./concatenatePromptPieces";
import OpenAICommand from "../../OpenAICommand";
import cliParser from "./cliParser";

import commander from "commander";

export default class OpenAICompletionCommand extends OpenAICommand<OpenAICompletionCLIOptions> {
    static subCommandName = "openai-completion";
    static description = "Generate text using OpenAI's Completion API";
    static showHelpOnEmptyArgsAndOptions = true;

    constructor(protected ctx: SubCommandContext) {
        super();
        this.run = this.run.bind(this);
        this.verifyCLI = this.verifyCLI.bind(this);
    }

    static addSubCommandTo(
        program: commander.Command,
        scriptContext: ScriptContext
    ): commander.Command {
        const basicCommand = program
            .command(this.subCommandName)
            .description(this.description);
        const fullcommand = cliParser(
            basicCommand,
            scriptContext
        );

        return fullcommand;
    }

    verifyCLI(): OpenAICompletionCLIOptions | VerifyCLIError {
        const {unverifiedSubCommandOpts} = this.ctx;

        // TODO don't verify the cli options, just verify what you send to the API?
        // or do another verification step after you transform the cli opts to api opts?
        const openaiCompletionOptsOrErr =
            openaiCompletionCLIOptionsSchema.safeParse(
                unverifiedSubCommandOpts
            );
        if (!openaiCompletionOptsOrErr.success) {
            return new VerifyCLIError(
                zodErrorToMessage(openaiCompletionOptsOrErr.error)
            );
        }
        const openaiCompletionCLIOpts = openaiCompletionOptsOrErr.data;

        // Set here so there's no chance of the API key showing up in commander output
        return openaiCompletionCLIOpts;
    }

    async callAPI(
        verifiedOpts: OpenAICompletionCLIOptions
    ): Promise<ScriptReturn | KnownSafeRunError> {
        // check if we're in CLI mode, and if so, set scriptContext.isCLI
        const {
            topLevelCommandOpts,
            subCommandArgs: args,
        } = this.ctx;

        // If 'promptFile' is set, read the file here and set 'promptFileContents' to the file contents
        const {promptFile} = verifiedOpts;
        let promptFileContents: string | undefined;
        if (promptFile) {
            promptFileContents =
                await getFileContents(promptFile);
        }

        const prompt = await concatenatePromptPieces(args, verifiedOpts, promptFileContents);

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

        // TODO: ensure these args are typed correctly
        const {debug} = topLevelCommandOpts;
        const apiOptions = convertOpenAICompletionCLIOptionsToAPIOptions(verifiedOpts, prompt);


        // NOTE: Despite the API options all being snake_case, the node client uses "apiKey"
        const configuration = new Configuration({apiKey});
        const openai = new OpenAIApi(configuration);

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
        let output = "";
        if (completionChoices.length > 1) {
            completionChoices.forEach((choice, i) => {
                // Labeled numbered list:
                //output += `${i + 1}. ${choice.text?.trim()}\n`;
                output += `${choice.text?.trim()}\n`;
            });
        } else {
            // TODO: implement -x conditional trim() here
            output = completionChoices[0].text?.trim() ?? "";
        }

        if (output.trim() === "") {
            return new KnownSafeRunError("[ERROR] No text returned.");
        }

        // TODO: check that completionResponse is safe to display remotely, or if it contains api key
        return {
            status: "success",
            exitCode: 0,
            output,
            data: completionResponse.data,
        };
    }
}
