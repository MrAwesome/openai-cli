import {
    SubCommand,
    ScriptReturn,
    SubCommandContext,
    ParseCLIError,
    VerifyCLIError,
    KnownSafeRunError,
    APIKeyNotSetError,
    ScriptContext,
} from "../../types";
import {AxiosResponse} from "axios";
import {Configuration, CreateCompletionResponse, OpenAIApi} from "openai";
import {debugData, getFileContents} from "../../utils";
import {OPENAI_API_KEY_NOT_SET_ERROR} from "../../defaultSettings";
import {propsToSnakeCase, zodErrorToMessage} from "../../utils";
import {
    OpenAICompletionCLIOptions,
    openAICompletionCLIOptionsSchema,
} from "./validation";
import concatenatePromptPieces from "./concatenatePromptPieces";
import OpenAICommand from "../../OpenAICommand";
import {myParseInt} from "../../utils";
import {
    SCRIPT_DEFAULTS,
    OPENAI_COMPLETION_DEFAULTS,
} from "../../defaultSettings";

import commander from "commander";

// TODO: with no args, output help text

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
        const fullcommand = openaiCompletionCLIParser(
            basicCommand,
            scriptContext
        );

        return fullcommand;
    }

    verifyCLI(): OpenAICompletionCLIOptions | VerifyCLIError {
        const {
            unverifiedSubCommandOpts: camelCasePreVerifiedOpts,
            subCommandArgs,
        } = this.ctx;
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
            topLevelCommandOpts,
            unverifiedSubCommandOpts,
            subCommandArgs: args,
        } = this.ctx;

        // If 'prompt_file' is set, read the file here and set 'promptFileContents' to the file contents
        const {prompt_file} = verifiedOpts;
        let promptFileContents: string | undefined;
        if (prompt_file) {
            promptFileContents =
                await getFileContents(prompt_file);
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
        const {model, echo, repeat, max_tokens} = verifiedOpts;
        const {debug} = topLevelCommandOpts;

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

function openaiCompletionCLIParser(
    subCommand: commander.Command,
    scriptContext: ScriptContext
): commander.Command {
    const {
        frequency_penalty,
        prompt_flag,
        max_tokens,
        model,
        repeat,
        temperature,
        logit_bias,
        top_p,
        presence_penalty,
        stream,
        echo,
        stop,
        user,
        best_of,
        prompt_file,
        prompt_suffix,
        prompt_prefix,
        trim,
    } = OPENAI_COMPLETION_DEFAULTS;

    // TODO: replace the "The <thing> to use" with the actual description from the openai docs.
    const cmd = subCommand
        // TODO: explain frequency/presence
        .option(
            "-F, --frequency-penalty <frequency_penalty>",
            `The frequency penalty to use.`,
            parseFloat,
            frequency_penalty
        )
        .option(
            "-P, --presence-penalty <presence_penalty>",
            `The presence penalty to use.`,
            parseFloat,
            presence_penalty
        )
        .option(
            "-M, --max-tokens <max_tokens>",
            `The max tokens to use *for the total completion, including the prompt and response*.`,
            myParseInt,
            max_tokens
        )
        .requiredOption("-m, --model <model>", `The model to use.`, model)
        .option(
            "-r, --repeat <n>",
            `How many times to repeat the prompt to the model. Careful using large values, as this can quickly eat through the API quota.`,
            myParseInt,
            repeat
        )
        .option(
            "-t, --temperature <temperature>",
            `The temperature to use.`,
            parseFloat,
            temperature
        )
        .option("-p, --prompt", `The prompt to use.`, prompt_flag)

        // Currently <unused>:
        .option(
            "-b, --best-of <best_of>",
            `The number of choices to generate and then choose from.`,
            myParseInt,
            best_of
        )
        .option(
            "-e, --echo",
            `Echo the prompt back before the completion.`,
            echo
        )
        .option(
            "-L, --logit-bias <logit_bias>",
            `The logit bias to use.`,
            logit_bias
        )
        // NOTE: the api actually supports an array here too, up to four elements
        .option("-S, --stop <stop>", `The stop sequence to use.`, stop)
        .option("-s, --stream", `Stream the response.`, stream)
        .option(
            "-T, --top-p <top_p>",
            `The top-p to use. Not recommended to alter both top_p and temperature at the same time.`,
            parseFloat,
            top_p
        )
        .option("-u, --user <user>", `The user to use.`, user)
        // TODO: Actually, should prompts end with <|endoftext|> or \n? I'm not sure the difference, should read up on that.
        .option(
            "-x, --trim",
            "By default, a newline is added to the prompt sent to the model. This option removes that newline. Responses with this option will not be as likely to feel like conversations, but will be quite good at finishing a particular sentence/phrase/thought.",
            trim
        )
        .option(
            "--prompt-suffix <prompt_suffix>",
            `The suffix to add to the prompt.`,
            prompt_suffix
        )
        .option(
            "--prompt-prefix <prompt_prefix>",
            `The prefix to add to the prompt.`,
            prompt_prefix
        )

        // Unused, as they don't add anything to the functionality of a CLI:
        //.option('-l, --logprobs <logprobs>', `Whether to log probability thresholds`, parseFloat, logprobs)

        .arguments("[prompt...]");

    if (scriptContext.isRemote === false) {
        cmd.option(
            "-f, --prompt-file <prompt_file>",
            `A file whose contents should be read and used as the OpenAI completion prompt. Mutually exclusive with --prompt or passing args as the prompt.`,
            prompt_file
        );
    }

    return cmd;
}
