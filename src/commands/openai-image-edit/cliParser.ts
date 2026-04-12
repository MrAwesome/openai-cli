import {myParseInt} from "../../utils";
import {ScriptContext} from "../../types";
import commander from "commander";
import {
    openaiImageCLIOptionsLOCALSchemaDefaults,
    openaiImageCLIOptionsREMOTESchemaDefaults,
} from "../openai-image/validation";

function collectInputImage(value: string, previous: string[]): string[] {
    return previous.concat([value]);
}

export default function openaiImageEditCLIParser(
    subCommand: commander.Command,
    scriptContext: ScriptContext
): commander.Command {
    const d = scriptContext.isRemote
        ? openaiImageCLIOptionsREMOTESchemaDefaults
        : openaiImageCLIOptionsLOCALSchemaDefaults;

    const cmd = subCommand
        .option(
            "-m, --model <model>",
            `GPT Image model: gpt-image-1.5, gpt-image-1, or gpt-image-1-mini. Used with the Images edit API (up to 16 input images).`,
            d.model
        )
        .option(
            "-r, --repeat <n>",
            `How many edited images to generate (1–10).`,
            myParseInt,
            d.repeat
        )
        .option(
            "-s, --size <size>",
            `Image size: auto, square 1024x1024, 1536x1024, 1024x1536, or aliases landscape (1536x1024) / portrait (1024x1536).`,
            d.size
        )
        .option(
            "--output-format <format>",
            `Saved file extension (png, jpeg, or webp). For file-based edits the API chooses encoding; this is used for output paths and as a fallback if the response omits output_format.`,
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
        .option("-p, --prompt <prompt>", `Edit instruction / prompt.`)
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
            "-i, --image <path>",
            `Input image file. Repeat -i for multiple images (GPT Image models allow up to 16).`,
            collectInputImage,
            [],
        );
        cmd.option(
            "--mask <path>",
            `Optional mask image (PNG). Transparent regions indicate where to edit; must match dimensions of the first input image.`,
        );
        cmd.option(
            "--input-fidelity <level>",
            `For gpt-image-1 and gpt-image-1.5 only: high or low. Controls how closely the output matches input faces/style. Not supported for gpt-image-1-mini.`,
            (v: string) => {
                if (v !== "high" && v !== "low") {
                    throw new commander.InvalidArgumentError("Expected 'high' or 'low'.");
                }
                return v;
            },
        );
        cmd.option(
            "-f, --prompt-file <promptFile>",
            `A file whose contents are combined into the edit prompt.`,
        );
    }

    return cmd;
}
