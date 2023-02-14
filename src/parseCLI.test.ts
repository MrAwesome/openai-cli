import parseCLI from "./parseCLI";
import {ScriptContext, SubCommandContext} from "./types";
import process from "process";
import commander from "commander";
import {noop} from "./utils";
import {OPENAI_COMPLETION_DEFAULTS} from "./defaultSettings";
import OpenAICompletionCommand from "./commands/openai-completion/OpenAICompletionCommand";

// TODO: add 'null' or 'upstream' to force using the API's default for certain values
// TODO: default values file

type CTX = SubCommandContext;

// Commander looooves to make a lot of noise to stderr in local runs, so shut it up
function shutUpCommander(_testName: string) {
    return (program: commander.Command) => {
        program.configureOutput({
            writeOut: () => {},
            writeErr: () => {},
        });
    };
}

function makeCommanderSayTestName(testName: string) {
    return (program: commander.Command) => {
        program.configureOutput({
            writeOut: (str) => {
                console.log(`[INFO](${testName}): ${str}`);
            },
            writeErr: (str) => {
                console.log(`[ERR](${testName}): ${str}`);
            },
        });
    };
}

// NOTE: change this to 'makeCommanderSayTestName' to see the commander output
const COMMANDER_OUTPUT_CONTROL = shutUpCommander;
noop(makeCommanderSayTestName);

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
type CheckType = number | {commanderErrorCode: string} | {validator: Validator};

const usageChecker = vd((res) => {
    expect(res).toHaveProperty("helpText");
    const hasUsage = (res as any).helpText.startsWith("Usage:");
    expect(hasUsage).toBe(true);
});

const testYester = vd((res) => {
    expect((res as CTX).subCommandConstructor).toBe(OpenAICompletionCommand);
    const ctx = res as CTX;

    // Test args are passed through
    expect(ctx.subCommandArgs).toStrictEqual(["YESTER"]);

    // Test that at least one default setting is being passed through
    expect(ctx.unverifiedSubCommandOpts.model).toBe(
        OPENAI_COMPLETION_DEFAULTS.model
    );
});

// TODO: track down why 'error: unknown command' is still showing up in logs
// TODO: add tests for:
//   []: --help in various positions (before and after subcommand)
describe("testCLIParsing", () => {
    const data: [string, ScriptContext, CheckType][] = [
        [...sc("local", []), 1],
        [...sc("local", ["--help"]), 1],
        [...sc("local", ["node", "filename.js", "--help"]), 0],
        [...sc("local", ["--LKjLKJDSF"]), 1],
        [...sc("local", ["LKjLKJDSF"]), 1],
        [...sc("local", ["node", "filename.js", "LKjLKJDSF"]), 1],
        [
            ...sc("local", [
                "node",
                "filename.js",
                "openai-completion",
                "YESTER",
                "-m",
                "FAKE_MODEL",
            ]),
            vd((res) => {
                expect((res as CTX).unverifiedSubCommandOpts.model).toBe(
                    "FAKE_MODEL"
                );
            }),
        ],
        [
            ...sc("local", [
                "node",
                "filename.js",
                "openai-completion",
                "-m",
                "FAKE_MODEL",
                "YESTER",
            ]),
            vd((res) => {
                expect((res as CTX).unverifiedSubCommandOpts.model).toBe(
                    "FAKE_MODEL"
                );
            }),
        ],
        [
            ...sc("local", [
                "node",
                "fillasjflkasjfd.js",
                "openai-completion",
                "fly me to the moon",
            ]),
            vd((res) => {
                expect((res as CTX).subCommandArgs).toStrictEqual([
                    "fly me to the moon",
                ]);
                expect((res as CTX).scriptContext.isRemote).toStrictEqual(
                    false
                );
            }),
        ],
        [
            ...sc("local", [
                "node",
                "filename.js",
                "openai-completion",
                "--prompt-file",
                "anything.txt",
            ]),
            vd((res) => {
                expect((res as CTX).unverifiedSubCommandOpts.promptFile).toBe(
                    "anything.txt"
                );
            }),
        ],
        [
            ...sc("local", [
                "node",
                "filename.js",
                "openai-completion",
                "-f",
                "anything.json",
            ]),
            vd((res) => {
                expect((res as CTX).unverifiedSubCommandOpts.promptFile).toBe(
                    "anything.json"
                );
            }),
        ],

        [...sc("remote", ["--help"]), usageChecker],
        [...sc("remote", ["node", "filename.js", "--help"]), usageChecker],
        [
            ...sc("remote", ["node", "filename.js", "basic test"]),
            {commanderErrorCode: "commander.unknownCommand"},
        ],
        [
            ...sc("remote", ["--FAKEJFKSLDJF"]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
        [
            ...sc("remote", ["node", "filename.js", "--FAKEJFKSLDJF"]),
            {commanderErrorCode: "commander.unknownCommand"},
        ],
        [
            ...sc("remote", [
                "node",
                "filename.js",
                "openai-completion",
                "YESS",
            ]),
            {commanderErrorCode: "commander.unknownCommand"},
        ],
        [...sc("remote", ["openai-completion", "YESTER"]), testYester],
        [
            ...sc("remote", [
                "openai-completion",
                "-m",
                "FAKE_MODEL",
                "YESTER",
            ]),
            vd((res) => {
                expect((res as CTX).unverifiedSubCommandOpts.model).toBe(
                    "FAKE_MODEL"
                );
            }),
        ],
        [
            ...sc("remote", [
                "openai-completion",
                "YESTER",
                "-m",
                "FAKE_MODEL",
            ]),
            vd((res) => {
                expect((res as CTX).unverifiedSubCommandOpts.model).toBe(
                    "FAKE_MODEL"
                );
            }),
        ],
        [
            ...sc("remote", ["openai-completion", "fly me to the moon"]),
            vd((res) => {
                expect((res as CTX).subCommandArgs).toStrictEqual([
                    "fly me to the moon",
                ]);
                expect((res as CTX).scriptContext.isRemote).toStrictEqual(true);
            }),
        ],
        [
            ...sc("remote", ["--DOOPDOOPDOO", "YUH"]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
        [
            ...sc("remote", ["DOOPDOOPDOO", "YUH"]),
            {commanderErrorCode: "commander.unknownCommand"},
        ],
        [
            ...sc("remote", ["--file", "anything.txt"]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
        [
            ...sc("remote", ["-f", "anything.json"]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
        [
            ...sc("remote", [
                "openai-completion",
                "--prompt-file",
                "anything.txt",
            ]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
        [
            ...sc("remote", ["openai-completion", "-f", "anything.json"]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
    ];

    test.each(data)("parseCLI(%s)", (title, scriptContext, checkType) => {
        // Don't spam the console with commander help text.
        jest.spyOn(
            commander.Command.prototype,
            "outputHelp"
        ).mockImplementation(() => {});

        /// Mock process.exit so we can check the exit code
        let called = 0;
        jest.spyOn(process, "exit").mockImplementation(
            (code?: number | undefined) => {
                const expectedExitCode = checkType as number;
                expect(code).toBe(expectedExitCode);
                called += 1;
                throw new ExpectedProcessExitError();
            }
        );

        // The parseCLI function should pass, and then pass the validator function checks
        if (typeof checkType === "object" && "validator" in checkType) {
            try {
                const res = parseCLI(
                    scriptContext,
                    COMMANDER_OUTPUT_CONTROL(title)
                );
                checkType.validator(res);
            } catch (e) {
                console.log(e);
                throw e;
            }
            return;
            // The parseCLI function should fail, and process.exit should have been called with the expected error code
        } else if (typeof checkType === "number") {
            try {
                parseCLI(scriptContext, COMMANDER_OUTPUT_CONTROL(title));
            } catch (e) {
                // process.exit should have been called once
                expect(called).toBe(1);
                if (e instanceof ExpectedProcessExitError) {
                    return;
                }
                console.log(e);
                throw e;
            }
            // The parseCLI function should fail, and commander should have thrown an error with the given errorCode
        } else if (
            typeof checkType === "object" &&
            "commanderErrorCode" in checkType
        ) {
            try {
                parseCLI(scriptContext, COMMANDER_OUTPUT_CONTROL(title));
            } catch (e) {
                if (
                    e instanceof commander.CommanderError &&
                    e.code === checkType.commanderErrorCode
                ) {
                    return;
                }
                console.log(e);
                throw e;
            }
        }
        throw new Error("Didn't throw, but should have.");
    });
});
