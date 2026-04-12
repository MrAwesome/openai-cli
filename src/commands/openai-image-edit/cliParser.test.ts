import openaiImageEditCLIParser from "./cliParser";
import commander from "commander";
import {ScriptContext} from "../../types";
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

describe("openai-image-edit cliParser", () => {
    let subCommand: commander.Command;
    beforeEach(() => {
        subCommand = new commander.Command();
        subCommand.exitOverride();
        COMMANDER_OUTPUT_CONTROL("OpenAIImageEditCommand")[1](subCommand);
    });

    it("collects multiple -i paths (local)", () => {
        const context = makeContext(false);
        const cmd = openaiImageEditCLIParser(subCommand, context);
        cmd.parse(["-i", "a.png", "--image", "b.jpg"], {from: "user"});
        expect(cmd.opts().image).toStrictEqual(["a.png", "b.jpg"]);
    });

    it("parses mask and input-fidelity (local)", () => {
        const context = makeContext(false);
        const cmd = openaiImageEditCLIParser(subCommand, context);
        cmd.parse(
            ["-i", "x.png", "--mask", "m.png", "--input-fidelity", "high"],
            {from: "user"}
        );
        const opts = cmd.opts();
        expect(opts.image).toStrictEqual(["x.png"]);
        expect(opts.mask).toBe("m.png");
        expect(opts.inputFidelity).toBe("high");
    });

    it.each`
        name                 | isRemote | args                              | shouldThrow
        ${"image local ok"}  | ${false} | ${["-i", "a.png"]}                | ${{}}
        ${"image remote bad"}| ${true}  | ${["-i", "a.png"]}                | ${{commanderErrorCode: "commander.unknownOption"}}
        ${"mask remote bad"} | ${true}  | ${["--mask", "m.png"]}            | ${{commanderErrorCode: "commander.unknownOption"}}
    `("$name", ({isRemote, args, shouldThrow}: {
        isRemote: boolean;
        args: string[];
        shouldThrow: {commanderErrorCode?: string};
    }) => {
        const context = makeContext(isRemote);
        const cmd = openaiImageEditCLIParser(subCommand, context);
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
