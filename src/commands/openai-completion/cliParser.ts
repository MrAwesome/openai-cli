import {
    openaiCompletionCLIOptionsLOCALSchemaDefaults,
    openaiCompletionCLIOptionsREMOTESchemaDefaults,
} from "./validation";
import {myParseInt} from "../../utils";
import {ScriptContext} from "../../types";
import commander from "commander";

function collectImagePath(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}

export default function openaiCompletionCLIParser(
    subCommand: commander.Command,
    scriptContext: ScriptContext
): commander.Command {
    const d = scriptContext.isRemote
        ? openaiCompletionCLIOptionsREMOTESchemaDefaults
        : openaiCompletionCLIOptionsLOCALSchemaDefaults;

    // TODO: replace the "The <thing> to use" with the actual description from the openai docs.
    const cmd = subCommand
        .option(
            "--provider <provider>",
            `Model provider to use (openai or gemini).`,
            d.provider
        )
        // TODO: explain frequency/presence
        .option(
            "-F, --frequency-penalty <frequencyPenalty>",
            `The frequency penalty to use.`,
            parseFloat,
            d.frequencyPenalty
        )
        .option(
            "-P, --presence-penalty <presencePenalty>",
            `The presence penalty to use.`,
            parseFloat,
            d.presencePenalty
        )
        .option(
            "-M, --max-tokens <maxTokens>",
            `Maximum completion tokens the model may generate (output only; reasoning-capable models share this budget with internal reasoning).`,
            myParseInt,
            d.maxTokens
        )
        .option("-m, --model <model>", `The model to use.`,
            d.model
        )
        .option(
            "-r, --repeat <n>",
            `How many times to repeat the prompt to the model. Careful using large values, as this can quickly eat through the API quota.`,
            myParseInt,
            d.repeat
        )
        .option(
            "-t, --temperature <temperature>",
            `The temperature to use.`,
            parseFloat,
            d.temperature
        )
        .option(
            "-e, --endpoint <endpoint>",
            `The OpenAI API-compatible endpoint to use. Defaults to actual OpenAI. Use the string 'local' to default to 'http://localhost:8080/v1', for the llama.cpp local server.`,
        )
        .option("-l, --local",
                "Shorthand for '-e local'. Overridden by '-e'.")
        .option("-p, --prompt <prompt>", `The prompt to use.`)

        .option(
            "-L, --logit-bias <logitBias>",
            `The logit bias to use.`,
        )
        // NOTE: the api actually supports an array here too, up to four elements
        .option("--stop <stop>", `The stop sequence to use.`)
        .option("-S, --stream", `Stream the response.`,
            d.stream
        )
        .option(
            "-T, --top-p <topP>",
            `The top-p to use. Not recommended to alter both topP and temperature at the same time.`,
            parseFloat,
            d.topP
        )
        .option("-u, --user <user>", `The user to use.`,
            d.user
        )
        // TODO: Actually, should prompts end with <\|endoftext|> or \n? I'm not sure the difference, should read up on that.
        .option(
            "-n, --no-trailing-newline",
            "By default, a newline is added to the prompt sent to the model. This option removes that newline. Responses with this option will not be as likely to feel like conversations, but will be quite good at finishing a particular sentence/phrase/thought.",
            d.trailingNewline
        )
        .option(
            "--prompt-suffix <promptSuffix>",
            `The suffix to add to the prompt.`,
        )
        .option(
            "--prompt-prefix <promptPrefix>",
            `The prefix to add to the prompt.`,
        )
        .option(
            "--prompt-joiner <promptJoiner>",
            `The string which joins the various pieces of the prompt (prefix, suffix, file, etc).`,
            d.promptJoiner
        )
        .option(
            "-N, --no-joiner",

            "Shorthand for --prompt-joiner ''. Prompt pieces will be treated as a single string, with no newlines or other separators. Takes precedence over --prompt-joiner.",
            !d.joiner
        )
        .option(
            "-s, --system <system>",
            "System instructions prepended to the chat (optional).",
            d.system
        )

        // Unused, as they don't add anything to the functionality of a CLI:
        //.option('-l, --logprobs <logprobs>', `Whether to log probability thresholds`, parseFloat, logprobs)

        .arguments("[prompt...]");

    if (scriptContext.isRemote === false) {
        cmd.option(
            "-f, --prompt-file <promptFile>",
            `A file whose contents should be read and used as the OpenAI completion prompt. Mutually exclusive with --prompt or passing args as the prompt.`,
        );
        cmd.option(
            "-i, --image <path>",
            `Attach a local image to the user message (vision models). Repeat -i for multiple images. MIME type is detected from file contents.`,
            collectImagePath,
            [],
        );
    }

    return cmd;
}
