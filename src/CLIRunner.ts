import parseCLI from "./parseCLI";
import {
    ScriptReturn,
    ScriptContext,
    KnownSafeRunError,
    ParseCLIError,
    SubCommandContext,
} from "./types";

export default class CLIRunner {
    constructor(private scriptContext: ScriptContext) {
        this.run = this.run.bind(this);
        this.run_INTERNAL = this.run_INTERNAL.bind(this);
    }

    async run(): Promise<ScriptReturn> {
        const {isRemote} = this.scriptContext;
        try {
            return await this.run_INTERNAL();
        } catch (e: any) {
            if (["true", "1"].includes(process.env.DEBUG_THROW ?? "false")) {
                throw e;
            }
            if (isRemote) {
                console.log(
                    `[ERROR] Unknown error in remote run: ${e.message}`
                );
                return {
                    status: "failure_safe",
                    exitCode: 1,
                    stderr: `[ERROR]: ${e.name}. This is an unexpected error.
Please contact the server administrator and let them know: ${this.scriptContext.serverAdminContactInfo}`,
                };
            } else {
                return {
                    status: "failure_unsafe",
                    exitCode: 1,
                    stderr: `[ERROR]: ${e.name} ${e.message}`,
                    error: e,
                };
            }
        }
    }

    private async run_INTERNAL(): Promise<ScriptReturn> {
        // This is where we actually parse the CLI and display help text
        const parseRes = parseCLI(this.scriptContext);

        if (parseRes instanceof ParseCLIError) {
            return {
                status: "failure_safe",
                exitCode: 1,
                stderr: parseRes.message,
            };
        }

        if ("helpText" in parseRes) {
            return {
                status: "exit",
                exitCode: 0,
                output: parseRes.helpText,
            };
        }

        // TODO: you can possibly just pass in SubCommandContext to this function or a similar one directly,
        //       to allow for more direct/programmatic control over command behavior
        const subCommandContext: SubCommandContext = parseRes;
        const {subCommandConstructor} = subCommandContext;

        const subCommand = new subCommandConstructor(subCommandContext);

        const ret = await subCommand.run();

        if (ret instanceof KnownSafeRunError) {
            return {
                status: "failure_safe",
                exitCode: 1,
                stderr: ret.message,
            };
        }

        return ret;
    }
}
