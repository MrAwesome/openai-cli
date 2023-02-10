import {
    SubCommand,
    ScriptReturn,
    SubCommandContext,
    ParseCLIError,
    VerifyCLIError,
    KnownSafeRunError,
    APIKeyNotSetError,
} from "../../types";
import {AxiosResponse} from "axios";
import {Configuration, CreateCompletionResponse, OpenAIApi} from "openai";
import {debugData} from "../../utils";
import {OPENAI_API_KEY_NOT_SET_ERROR} from "../../defaultSettings";
import type commander from "commander";
import {openaiCompletionCLIParser} from "./openaiCompletionCLIParser";
import {propsToSnakeCase, zodErrorToMessage} from "../../utils";
import {
    OpenAICompletionCLIOptions,
    openAICompletionCLIOptionsSchema,
} from "./validation";
import constructPrompt from "./constructPrompt";
import OpenAICommand from "../../OpenAICommand";

// TODO: with no args, output help text

export default class OpenAICompletionCommand extends OpenAICommand<OpenAICompletionCLIOptions> {
    static subCommandName = "openai-completion";
    static description = "Generate text using OpenAI's Completion API";
    static showHelpOnEmptyArgsAndOptions = true;

    constructor(protected ctx: SubCommandContext) {
        super();
    }

    static addSubCommandTo(program: commander.Command): commander.Command {
        const basicCommand = program
            .command(this.subCommandName)
            .description(this.description);
        const fullcommand = openaiCompletionCLIParser(basicCommand);

        return fullcommand;
    }

    verifyCLI(): OpenAICompletionCLIOptions | VerifyCLIError {
        const {subCommandOpts: camelCasePreVerifiedOpts, subCommandArgs} =
            this.ctx;
        const preVerifiedSnakeCaseOpts = propsToSnakeCase(
            camelCasePreVerifiedOpts
        );

        // TODO don't verify the cli options, just verify what you send to the API?
        // or do another verification step after you transform the cli opts to api opts?
        const openaiCompletionOptsOrErr =
            openAICompletionCLIOptionsSchema.safeParse(
                preVerifiedSnakeCaseOpts
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
            topLevelCommandOpts: scriptOpts,
            subCommandOpts,
            subCommandArgs: args,
        } = this.ctx;

        const prompt = await constructPrompt(args, verifiedOpts);

        if (prompt.length === 0) {
            return new KnownSafeRunError("[ERROR] No prompt text was provided.");
        }

        const apiKeyOrErr = this.getAPIKey();
        if (apiKeyOrErr instanceof APIKeyNotSetError) {
            return apiKeyOrErr;
        }
        const apiKey = apiKeyOrErr;

        // TODO: ensure these args are typed correctly
        const {model, echo, repeat, max_tokens} = verifiedOpts;
        const {debug} = scriptOpts;

        // NOTE: Despite the API options all being snake_case, the node client uses "apiKey"
        const configuration = new Configuration({apiKey});
        const openai = new OpenAIApi(configuration);

        let completionResponse: AxiosResponse<CreateCompletionResponse, any>;
        try {
            completionResponse = await openai.createCompletion({
                model,
                prompt,
                n: repeat,
                echo,
                max_tokens,
                // TODO: don't do this. pass them explicitly, or at least make sure to translate the cli opts into openai opts and zod validate those
                //...openaiCompletionCLIOpts,
            });
        } catch (e: any) {
            debug && (await debugData("openaiCompletionError", e));
            const message = this.sanitizeAndFormatOpenAIAPIError(e);
            return new KnownSafeRunError(message);
        }

        debug && debugData("openaiCompletion", completionResponse);

        const completionChoices = completionResponse.data.choices;

        // TODO: more generalized error handling
        if (completionChoices.length === 0) {
            return new KnownSafeRunError("[ERROR] No choices returned from the API.");
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
