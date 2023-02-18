import commander from "commander";

// Commander looooves to make a lot of noise to stderr in local runs, so shut it up
export function shutUpCommander(_testName: string) {
    return (program: commander.Command) => {
        program.configureOutput({
            writeOut: () => {},
            writeErr: () => {},
        });
    };
}

export function makeCommanderSayTestName(testName: string) {
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
