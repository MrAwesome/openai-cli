import commander from "commander";
import {ScriptContext} from "./types";
import {fn} from "jest-mock";

export interface JestMocks {
    writeOut: jest.Mock;
    writeErr: jest.Mock;
}

// Commander looooves to make a lot of noise to stderr in local runs, so shut it up
export function shutUpCommander(_testName: string): [JestMocks, (program: commander.Command) => void] {
    const mocks = {
        writeOut: fn(),
        writeErr: fn(),
    };
    return [mocks, (program: commander.Command) => {
        program.configureOutput(mocks);
    }];
}

export function makeCommanderSayTestName(testName: string): [JestMocks, (program: commander.Command) => void] {
    const mocks = {
        writeOut: fn((str) => {
            console.log(`[INFO](${testName}): ${str}`);
        }),
        writeErr: fn((str) => {
            console.log(`[ERR](${testName}): ${str}`);
        }),
    };
    return [mocks, (program: commander.Command) => {
        program.configureOutput(mocks);
    }];
}

export function sc(
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
