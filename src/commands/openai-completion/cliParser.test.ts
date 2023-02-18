import cliParser from "./cliParser";
import commander from "commander";
import {ScriptContext} from "../../types";
import {OpenAICompletionCLIOptions} from "./validation";
import {makeCommanderSayTestName, shutUpCommander} from "../../testUtils";
import {noop} from "../../utils";

// NOTE: change this to 'makeCommanderSayTestName' to see the commander output
const COMMANDER_OUTPUT_CONTROL = shutUpCommander;
noop(makeCommanderSayTestName);

function makeContext(isRemote: boolean): ScriptContext {
    const rawArgs: string[] = [];
    if (!isRemote) {
        return {
            isRemote,
            rawArgs, // Not used in these tests
        };
    } else {
        return {
            rawArgs,
            isRemote,
            serverAdminContactInfo: "blah@blah.blah",
        };
    }
}

describe("cliParser", () => {
    let subCommand: commander.Command;
    beforeEach(() => {
        subCommand = new commander.Command();
        subCommand.exitOverride();
        COMMANDER_OUTPUT_CONTROL("OpenAICompletionCommand")[1](subCommand);
    });

    it.each`
        name                    | args                              | expectedDeltaFromDefault
        ${"model"}              | ${["--model", "ada"]}             | ${{model: "ada"}}
        ${"maxTokens"}          | ${["--max-tokens", "100"]}        | ${{maxTokens: 100}}
        ${"frequencyPenalty"}   | ${["--frequency-penalty", "1.2"]} | ${{frequencyPenalty: 1.2}}
        ${"presencePenalty"}    | ${["--presence-penalty", "0.5"]}  | ${{presencePenalty: 0.5}}
        ${"temperature"}        | ${["--temperature", "0.75"]}      | ${{temperature: 0.75}}
        ${"repeat"}             | ${["--repeat", "3"]}              | ${{repeat: 3}}
        ${"prompt"}             | ${["--prompt", "hello world"]}    | ${{prompt: "hello world"}}
        ${"user"}               | ${["--user", "bob"]}              | ${{user: "bob"}}
        ${"bestOf"}             | ${["--best-of", "3"]}             | ${{bestOf: 3}}
        ${"echo"}               | ${["--echo", "true"]}             | ${{echo: true}}
        ${"stop"}               | ${["--stop", "foo"]}              | ${{stop: "foo"}}
        ${"stream"}             | ${["--stream", "true"]}           | ${{stream: true}}
        ${"topP"}               | ${["--top-p", "0.9"]}             | ${{topP: 0.9}}
        ${"promptSuffix"}       | ${["--prompt-suffix", "!"]}       | ${{promptSuffix: "!"}}
        ${"promptPrefix"}       | ${["--prompt-prefix", "oh"]}      | ${{promptPrefix: "oh"}}
        ${"promptJoiner space"} | ${["--prompt-joiner", " "]}       | ${{promptJoiner: " ", joiner: true}}
        ${"promptJoiner empty"} | ${["--prompt-joiner", ""]}        | ${{promptJoiner: "", joiner: true}}
        ${"no joiner"}          | ${["--no-joiner"]}                | ${{joiner: false}}
        ${"no trailingNewline"} | ${["--no-trailing-newline"]}      | ${{trailingNewline: false}}
    `(
        "$name",
        ({
            name,
            args,
            expectedDeltaFromDefault,
        }: {
            name: string;
            args: string[];
            expectedDeltaFromDefault: Partial<OpenAICompletionCLIOptions>;
        }) => {
            const context = makeContext(false);
            const cmd = cliParser(subCommand, context);

            cmd.parse(args, {from: "user"});
            const opts = cmd.opts();
            for (const [key, value] of Object.entries(
                expectedDeltaFromDefault
            )) {
                if (opts[key] !== value) {
                    console.log(name, {opts}, [key, value]);
                }
                expect(opts[key]).toStrictEqual(value);
            }
        }
    );

    it.each`
        name                    | isRemote | args                              | shouldThrow
        ${"model"}              | ${true}  | ${["--model", "ada"]}             | ${{}}
        ${"model"}              | ${false} | ${["--model", "ada"]}             | ${{}}
        ${"file allowed local"} | ${false} | ${["--prompt-file", "foo.txt"]}   | ${{}}
        ${"file disallowed"}    | ${true}  | ${["--prompt-file", "foo.txt"]}   | ${{commanderErrorCode: "commander.unknownOption"}}
        ${"fake arg"}           | ${true}  | ${["--fake-arg", "foo.txt"]}      | ${{commanderErrorCode: "commander.unknownOption"}}
        ${"fake arg"}           | ${false} | ${["--fake-arg", "foo.txt"]}      | ${{commanderErrorCode: "commander.unknownOption"}}
    `("$name", ({isRemote, args, shouldThrow}:
                {isRemote: boolean, args: string[], shouldThrow: {commanderErrorCode?: string}}
               ) => {
        const context = makeContext(isRemote);
        const cmd = cliParser(subCommand, context);
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
