import parseCLI from "./parseCLI";
import {ScriptContext, SubCommand} from "./types";
import process from "process";
import commander from "commander";
import {noop} from "./utils";
import {OpenAICompletionCLIOptions} from "./commands/openai-completion/validation";
import {OPENAI_COMPLETION_DEFAULTS} from "./defaultSettings";

// TODO: add 'null' or 'upstream' to force using the API's default for certain values
// TODO: default values file

interface ErrorConstructor {
    new(...args: any[]): Error;
}

function sc(
    remote: "remote" | "local",
    args: string[]
): [string, ScriptContext] {
    const scriptContext: ScriptContext =
        remote === "remote"
            ? {
                rawArgs: args,
                isRemote: true,
                serverAdminContactInfo: "fake@fake.fake",
            }
            : {
                rawArgs: args,
                isRemote: false,
            };
    const title = `[${remote}]: "${args.join(" ")}"`;
    return [title, scriptContext];
}

class ExpectedProcessExitError extends Error {
    constructor() {
        super(`Expected`);
    }
}

// number: the exit code we expect to be passed to process.exit by commander
// {commanderErrorCode: string}: the error code we expect to be thrown by commander
// {validator: (res: ReturnType<typeof parseCLI>) => void}: a function that will be called with the result of parseCLI if it returns successfully
type Validator = (res: ReturnType<typeof parseCLI>) => void;
function vd(validator: Validator): {validator: Validator} {
    return {validator};
}
type CheckType = number
    | {commanderErrorCode: string}
    | {validator: Validator}

const usageChecker = vd((res) => {
    expect(res).toHaveProperty("helpText");
    const hasUsage = (res as any).helpText.startsWith("Usage:");
    expect(hasUsage).toBe(true);
})

const testYester = vd((res) => {
    expect(res).toBeInstanceOf(SubCommand);
    const cmd = res as SubCommand<OpenAICompletionCLIOptions>;

    // Test args are passed through
    expect((cmd as any).ctx.subCommandArgs).toStrictEqual(["YESTER"]);

    // Test that at least one default setting is being passed through
    expect((cmd as any).ctx.subCommandOpts.model).toBe(OPENAI_COMPLETION_DEFAULTS.model);
});

    // TODO: track down why 'error: unknown command' is still showing up in logs
    describe("testCLIParsing", () => {
        const data: [string, ScriptContext, CheckType][] = [
            [...sc("local", []), 1],
            [...sc("local", ["--help"]), 1],
            [...sc("local", ["node", "filename.js", "--help"]), 0],
            [...sc("local", ["--LKjLKJDSF"]), 1],
            [...sc("local", ["node", "filename.js", "openai-completion", "YESTER", "-m", "FAKE_MODEL"]), vd((res) => {expect((res as any).ctx.subCommandOpts.model).toBe("FAKE_MODEL")})],
            [...sc("local", ["node", "filename.js", "openai-completion", "-m", "FAKE_MODEL", "YESTER"]), vd((res) => {expect((res as any).ctx.subCommandOpts.model).toBe("FAKE_MODEL")})],
            [...sc("local", ["node", "fillasjflkasjfd.js", "openai-completion", "send me to the moon"]), vd((res) => {
                expect((res as any).ctx.subCommandArgs).toStrictEqual(["send me to the moon"]);
                expect((res as any).ctx.scriptContext.isRemote).toStrictEqual(false);
            })],

            [...sc("remote", ["--help"]), usageChecker],
            [...sc("remote", ["node", "filename.js", "--help"]), usageChecker],
            [...sc("remote", ["node", "filename.js", "basic test"]), {commanderErrorCode: "commander.unknownCommand"}],
            [...sc("remote", ["--FAKEJFKSLDJF"]), {commanderErrorCode: "commander.unknownOption"}],
            [...sc("remote", ["node", "filename.js", "--FAKEJFKSLDJF"]), {commanderErrorCode: "commander.unknownCommand"}],
            [...sc("remote", ["node", "filename.js", "openai-completion", "YESS"]), {commanderErrorCode: "commander.unknownCommand"}],
            [...sc("remote", ["openai-completion", "YESTER"]), testYester],
            [...sc("remote", ["openai-completion", "-m", "FAKE_MODEL", "YESTER"]), vd((res) => {expect((res as any).ctx.subCommandOpts.model).toBe("FAKE_MODEL")})],
            [...sc("remote", ["openai-completion", "YESTER", "-m", "FAKE_MODEL"]), vd((res) => {expect((res as any).ctx.subCommandOpts.model).toBe("FAKE_MODEL")})],
            [...sc("remote", ["openai-completion", "send me to the moon"]), vd((res) => {
                expect((res as any).ctx.subCommandArgs).toStrictEqual(["send me to the moon"]);
                expect((res as any).ctx.scriptContext.isRemote).toStrictEqual(true);
            })],
        ];

        test.each(data)(
            "parseCLI(%s)",
            (title, scriptContext, checkType) => {

                // Don't spam the console with commander help text.
                jest.spyOn(commander.Command.prototype, "outputHelp").mockImplementation(() => {});


                let called = 0;
                jest.spyOn(process, "exit").mockImplementation((code?: number | undefined) => {
                    const expectedExitCode = checkType as number;
                    expect(code).toBe(checkType);
                    called += 1;
                    throw new ExpectedProcessExitError();
                });

                if (typeof checkType === "object" && "validator" in checkType) {
                    try {
                        const res = parseCLI(scriptContext);
                        checkType.validator(res);
                    } catch (e) {
                        console.log(e);
                        throw e;
                    }
                    return;
                } else if (typeof checkType === "number") {
                    try {
                        parseCLI(scriptContext);
                    } catch (e) {
                        expect(called).toBe(1);
                        if (e instanceof ExpectedProcessExitError) {
                            return;
                        }
                        console.log(e);
                        throw e;
                    }
                } else if (typeof checkType === "object" && "commanderErrorCode" in checkType) {
                    try {
                        parseCLI(scriptContext);
                    }
                    catch (e) {
                        if (e instanceof commander.CommanderError
                            && e.code === checkType.commanderErrorCode) {
                            return;
                        }
                        console.log(e);
                        throw e;
                    }
                }
                throw new Error("Didn't throw, but should have.");
            }
        );
    });
