import openaiImageCLIParser from "./cliParser";
import commander from "commander";
import {ScriptContext} from "../../types";
import {OpenAIImageCLIOptions} from "./validation";
import {makeCommanderSayTestName, shutUpCommander} from "../../testUtils";
import {noop} from "../../utils";

const COMMANDER_OUTPUT_CONTROL = shutUpCommander;
noop(makeCommanderSayTestName);

function makeContext(isRemote: boolean): ScriptContext {
    const rawArgs: string[] = [];
    if (!isRemote) {
        return {
            isRemote,
            repoBaseDir: "fake_base_dir",
            initialCwd: "fake_initial_cwd",
            rawArgs,
        };
    }
    return {
        rawArgs,
        isRemote,
        repoBaseDir: "fake_base_dir",
        serverAdminContactInfo: "blah@blah.blah",
    };
}

describe("openai-image cliParser", () => {
    let subCommand: commander.Command;
    beforeEach(() => {
        subCommand = new commander.Command();
        subCommand.exitOverride();
        COMMANDER_OUTPUT_CONTROL("OpenAIImageCommand")[1](subCommand);
    });

    it.each`
        name              | args                              | expectedDeltaFromDefault
        ${"repeat"}       | ${["--repeat", "3"]}              | ${{repeat: 3}}
        ${"model"}        | ${["--model", "gpt-image-1"]}     | ${{model: "gpt-image-1"}}
        ${"size"}         | ${["--size", "1536x1024"]}        | ${{size: "1536x1024"}}
        ${"quality"}      | ${["--quality", "high"]}          | ${{quality: "high"}}
        ${"output format"}| ${["--output-format", "webp"]}    | ${{outputFormat: "webp"}}
        ${"output"}       | ${["--output", "out.png"]}        | ${{output: "out.png"}}
        ${"prompt"}       | ${["--prompt", "a red balloon"]}  | ${{prompt: "a red balloon"}}
        ${"user"}         | ${["--user", "bob"]}              | ${{user: "bob"}}
        ${"promptSuffix"} | ${["--prompt-suffix", "!"]}       | ${{promptSuffix: "!"}}
        ${"promptPrefix"} | ${["--prompt-prefix", "draw"]}    | ${{promptPrefix: "draw"}}
        ${"promptJoiner"} | ${["--prompt-joiner", " "]}       | ${{promptJoiner: " ", joiner: true}}
        ${"no joiner"}    | ${["--no-joiner"]}                | ${{joiner: false}}
        ${"trailing nl"}  | ${["--trailing-newline"]}         | ${{trailingNewline: true}}
    `(
        "$name",
        ({
            args,
            expectedDeltaFromDefault,
        }: {
            name: string;
            args: string[];
            expectedDeltaFromDefault: Partial<OpenAIImageCLIOptions>;
        }) => {
            const context = makeContext(false);
            const cmd = openaiImageCLIParser(subCommand, context);

            cmd.parse(args, {from: "user"});
            const opts = cmd.opts();
            for (const [key, value] of Object.entries(
                expectedDeltaFromDefault
            )) {
                expect(opts[key]).toStrictEqual(value);
            }
        }
    );

    it.each`
        name                    | isRemote | args                              | shouldThrow
        ${"file allowed local"} | ${false} | ${["--prompt-file", "foo.txt"]}   | ${{}}
        ${"file disallowed"}    | ${true}  | ${["--prompt-file", "foo.txt"]}   | ${{commanderErrorCode: "commander.unknownOption"}}
    `("$name", ({isRemote, args, shouldThrow}: {
        isRemote: boolean;
        args: string[];
        shouldThrow: {commanderErrorCode?: string};
    }) => {
        const context = makeContext(isRemote);
        const cmd = openaiImageCLIParser(subCommand, context);
        const parse = () => cmd.parse(args, {from: "user"});
        if ("commanderErrorCode" in shouldThrow) {
            try {
                parse();
            } catch (e: any) {
                expect(e.code).toStrictEqual(shouldThrow.commanderErrorCode);
            }
        } else {
            parse();
        }
    });
});
