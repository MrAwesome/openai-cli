import {
    openaiImageCLIOptionsLOCALSchemaDefaults,
    openaiImageCLIOptionsREMOTESchemaDefaults,
} from "./validation";
import {myParseInt} from "../../utils";
import {ScriptContext} from "../../types";
import commander from "commander";

export default function openaiImageCLIParser(
    subCommand: commander.Command,
    scriptContext: ScriptContext
): commander.Command {
    const d = scriptContext.isRemote
        ? openaiImageCLIOptionsREMOTESchemaDefaults
        : openaiImageCLIOptionsLOCALSchemaDefaults;

    const cmd = subCommand
        .option(
            "-m, --model <model>",
            `GPT Image model: gpt-image-1.5, gpt-image-1, or gpt-image-1-mini.`,
            d.model
        )
        .option(
            "-r, --repeat <n>",
            `How many images to generate (1–10).`,
            myParseInt,
            d.repeat
        )
        .option(
            "-s, --size <size>",
            `Image size: auto, 1024x1024, 1536x1024 (landscape), or 1024x1536 (portrait).`,
            d.size
        )
        .option(
            "-q, --quality <quality>",
            `Quality: auto, low, medium, or high (GPT Image models).`,
            d.quality
        )
        .option(
            "--output-format <format>",
            `File format: png, jpeg, or webp.`,
            d.outputFormat
        )
        .option(
            "-o, --output <path>",
            `Output path. With multiple images, writes <name>-1.ext, <name>-2.ext, etc. Defaults to image.png (or matching extension for --output-format).`,
            d.output
        )
        .option(
            "-e, --endpoint <endpoint>",
            `The OpenAI API-compatible endpoint to use. Defaults to actual OpenAI. Use the string 'local' to default to 'http://localhost:8080/v1', for the llama.cpp local server.`,
        )
        .option("-l, --local",
            "Shorthand for '-e local'. Overridden by '-e'.")
        .option("-p, --prompt <prompt>", `The image prompt.`)
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
            "--trailing-newline",
            "Append a newline to the assembled prompt before sending to the API.",
            d.trailingNewline
        )
        .option("-u, --user <user>", `The user to use.`,
            d.user
        )
        .arguments("[prompt...]");

    if (scriptContext.isRemote === false) {
        cmd.option(
            "-f, --prompt-file <promptFile>",
            `A file whose contents should be read and used as the image prompt. Combine with args or -p as needed.`,
        );
    }

    return cmd;
}
