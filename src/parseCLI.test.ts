import parseCLI from "./parseCLI";
import {CLIHelp, ParseCLIError, ScriptContext, SubCommandContext} from "./types";
import process from "process";
import commander from "commander";
import {noop} from "./utils";
import OpenAICompletionCommand from "./commands/openai-completion/OpenAICompletionCommand";
import {openaiCompletionCLIOptionsREMOTESchema} from "./commands/openai-completion/validation";
import {makeCommanderSayTestName, sc, shutUpCommander} from "./testUtils";

// TODO: add 'null' or 'upstream' to force using the API's default for certain values
// TODO: default values file

type CTX = SubCommandContext;

// NOTE: change this to 'makeCommanderSayTestName' to see the commander output
const COMMANDER_OUTPUT_CONTROL = shutUpCommander;
noop(makeCommanderSayTestName);

class ExpectedProcessExitError extends Error {
    constructor(public code: number) {
        super(`Expected`);
    }
}

const defaultRemoteOpts = openaiCompletionCLIOptionsREMOTESchema.parse({});

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
    expect(ctx.unverifiedSubCommandOpts.model).toBe(defaultRemoteOpts.model);
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
            ...sc("remote", ["--DOOP_OPTION", "YUH"]),
            {commanderErrorCode: "commander.unknownOption"},
        ],
        [
            ...sc("remote", ["DOOP_ARG", "YUH"]),
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
        /// Mock process.exit so we can check the exit code
        let called = 0;
        jest.spyOn(process, "exit").mockImplementation(
            (code?: number | undefined) => {
                const expectedExitCode = checkType as number;
                expect(code).toBe(expectedExitCode);
                called += 1;

                if (code === undefined) { code = 0; }
                throw new ExpectedProcessExitError(code);
            }
        );

        // The parseCLI function should pass, and then pass the validator function checks
        if (typeof checkType === "object" && "validator" in checkType) {
            try {
                const res = parseCLI(
                    scriptContext,
                    COMMANDER_OUTPUT_CONTROL(title)[1]
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
                parseCLI(scriptContext, COMMANDER_OUTPUT_CONTROL(title)[1]);
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
            const res = parseCLI(scriptContext, COMMANDER_OUTPUT_CONTROL(title)[1]);
            const e = (res as ParseCLIError).originalError;

            if (
                e instanceof commander.CommanderError &&
                e.code === checkType.commanderErrorCode
            ) {
                return;
            }
        } else {
            throw new Error("Somehow reached an impossible condition in test for:", checkType);
        }
        throw new Error("Didn't throw, but should have.");
    });
});

describe("help text", () => {
    beforeEach(() => {
        jest.spyOn(process, "exit").mockImplementation(
            (code?: number | undefined) => {
                if (code === undefined) { code = 0; }
                throw new ExpectedProcessExitError(code);
            }
        );
    });

    // Test that help output has the correct text
    test.each`
        titleAndScriptContext                            | expectedHelpTextRegexes
        ${sc("local", ["--help"])}                       | ${[/Usage: .*/, /openai-completion.*\[options\] \[prompt\.\.\.\]/, /help \[command\]/]}
        ${sc("local", ["node", "fake.js", "openai-completion", "--help"])}  | ${[/--model/, /--temperature/, /--max-tokens/]}
        ${sc("remote", ["--help"])}                      | ${[/Usage: .*/, /openai-completion.*\[options\] \[prompt\.\.\.\]/, /help \[command\]/]}
        ${sc("remote", ["openai-completion", "--help"])} | ${[/--model/, /--temperature/, /--max-tokens/]}
    `(
        "helpText($title)",
        ({
            titleAndScriptContext,
            expectedHelpTextRegexes,
        }: {
            titleAndScriptContext: [string, ScriptContext];
            expectedHelpTextRegexes: RegExp[];
        }) => {
            const [title, scriptContext] = titleAndScriptContext;

            if (scriptContext.isRemote) {
                let output: ReturnType<typeof parseCLI>;
                // The parseCLI function should pass, and then pass the validator function checks
                try {
                    output = parseCLI(
                        scriptContext,
                        COMMANDER_OUTPUT_CONTROL(title)[1]
                    );
                } catch (e) {
                    console.log(e);
                    throw e;
                }

                expect(output).toHaveProperty("helpText");

                for (const expectedHelpTextRegex of expectedHelpTextRegexes) {
                    expect((output as CLIHelp).helpText).toMatch(
                        expectedHelpTextRegex
                    );
                }
            } else {
                // The parseCLI function should fail, and process.exit should have been called with the expected error code
                const [mocks, outputControl] = COMMANDER_OUTPUT_CONTROL(title);
                let code: number | undefined;
                try {
                    parseCLI(scriptContext, outputControl);
                } catch (e) {
                    if (e instanceof ExpectedProcessExitError) {
                        code = e.code;
                    } else {
                        console.log(e);
                        throw e;
                    }
                }

                const {writeOut, writeErr} = mocks;

                if (code === undefined) {
                    throw new Error("Didn't exit, but should have.");
                } else if (code === 0) {
                    expect(writeOut).toHaveBeenCalledTimes(1);
                    for (const expectedHelpTextRegex of expectedHelpTextRegexes) {
                        expect(writeOut).toHaveBeenCalledWith(
                            expect.stringMatching(expectedHelpTextRegex)
                        );
                    }
                } else {
                    expect(writeErr).toHaveBeenCalledTimes(1);
                    for (const expectedHelpTextRegex of expectedHelpTextRegexes) {
                        expect(writeErr).toHaveBeenCalledWith(
                            expect.stringMatching(expectedHelpTextRegex)
                        );
                    }
                }
            }
        }
    );
});
