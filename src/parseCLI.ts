import {z} from "zod";
import commander from "commander";

import {
    CLIHelp,
    SubCommandConstructor,
    ParseCLIError,
    SubCommandContext,
    ScriptContext,
} from "./types";
import OpenAICompletionCommand from "./commands/openai-completion/OpenAICompletionCommand";
import {zodErrorToMessage} from "./utils";

// TODO: add support for "aliased" commands, such as "byron" - possibly can call this recursively with the desired args? it's just hard because commander's local mode doesn't get passed the args directly, it goes and determines them from the command line (and will try to fail if it sees an unrecognized command). maybe commands can be registered, but with an action that just recursively calls this with the desired function/args?
// TODO: it is probably much easier to just use .action instead of choosing subcommands manually - simply set the command name with .action
// TODO: just --help should be processed as if it were on the base command. how can you do that?
// TODO: translation layer between what commander gives us and what openai expects
// TODO: better ensure that all of these which are explicitly required are actually required
// TODO: alias commands (e.g. "completion" for "openai-completion", "gpt" for "openai-completion",
// TODO: specific alias commands ("codegen" "ts" etc) for specific prompts (figure out where to inject the prompts, or just disallow --prompt etc?)
// TODO: add a "prompt" subcommand which just prints out the prompt for a given subcommand
// TODO: support reading from stdin as a prompt source
// TODO: support sub-sub-commands ("codegen ts", "codegen js", "codegen python"?)

// TODO: determine if this should be used anywhere or if these are simple enough to just trust
const cliFlagsREMOTESchema = z
    .object({
        version: z.boolean().default(false), // TODO: unused
        debug: z.literal(false).default(false),
    })
    .strip();

const cliFlagsREMOTESchemaDefaults = cliFlagsREMOTESchema.parse({});

const cliFlagsLOCALSchema = cliFlagsREMOTESchema.extend({
    local_UNSAFE: z.literal(true).default(true),
    debug: z.boolean().default(false)
});

const cliFlagsLOCALSchemaDefaults = cliFlagsLOCALSchema.parse({});

const cliFlagsSchema = cliFlagsREMOTESchema.or(cliFlagsLOCALSchema);

export type TopLevelCLIFlags = z.infer<typeof cliFlagsSchema>;

const subCommandConstructors: SubCommandConstructor<any>[] = [
    OpenAICompletionCommand,
];
export default function parseCLI(
    scriptContext: ScriptContext,
    modifyProgramForTests?: (program: commander.Command) => void
): SubCommandContext | CLIHelp | ParseCLIError {
    // Manually remove 'node' and the script name from the args if it's a local run.
    // Normally, commander handles this for us
    //const prefixRemovedArgs = scriptContext.isRemote ? scriptContext.rawArgs : scriptContext.rawArgs.slice(2);

    const cliFlagsDefaults = scriptContext.isRemote ? cliFlagsREMOTESchemaDefaults : cliFlagsLOCALSchemaDefaults;

    const program = new commander.Command().option(
        "-v, --version",
        `Display version`,
        cliFlagsDefaults.version
    );

    if (!scriptContext.isRemote) {
        program.option("-d, --debug", `Enable debug mode`,
            cliFlagsDefaults.debug
        );
    }

    if (modifyProgramForTests !== undefined) {
        modifyProgramForTests(program);
    }

    // TODO: generate unit tests for:
    // - each subcommand's CLI parser
    // help command
    // --help
    //

    const subCommandNameToConstructorAndParser: Record<
        string,
        SubCommandConstructor<any>
    > = {};

    let subCmdCommanderContext:
        | {
            subCmdArgs: string[];
            subCmdDefaultOpts: commander.OptionValues;
            subCmd: commander.Command;
        }
        | undefined;

    let helpText = "";
    for (const subCommandConstructor of subCommandConstructors) {
        const cliParserSubCommand = subCommandConstructor.addSubCommandTo(
            program,
            scriptContext
        );
        cliParserSubCommand.action((subCmdArgs, subCmdDefaultOpts, subCmd) => {
            subCmdCommanderContext = {subCmdArgs, subCmdDefaultOpts, subCmd};
        });
        if (scriptContext.isRemote) {
            cliParserSubCommand.exitOverride();
            cliParserSubCommand.outputHelp = (_helpContext) => {
                helpText = cliParserSubCommand.helpInformation();
            };
        }

        subCommandNameToConstructorAndParser[
            subCommandConstructor.subCommandName
        ] = subCommandConstructor;
    }

    const mainCommandParseOptions: commander.ParseOptions = {
        from: scriptContext.isRemote ? "user" : "node",
    };

    // TODO: make a helper function for this
    //
    // For local (terminal) runs, we're fine with the default behavior,
    // but for remote runs, we want to catch CLI parsing errors and send them along the wire
    if (scriptContext.isRemote) {
        program.exitOverride((err) => {
            throw err;
        });
        program.outputHelp = (_helpContext) => {
            helpText = program.helpInformation();
        };
    }

    try {
        //program.parse(fixedFullCommandArgs_RAW, parseOptions);
        program.parse(scriptContext.rawArgs, mainCommandParseOptions);
    } catch (err) {
        if (helpText) {
            return {helpText};
        } else {
            throw err;
        }
    }
    const topLevelOpts = program.opts();

    if (topLevelOpts.help) {
        return {helpText: program.helpInformation()};
    }

    // zod parse the options:
    // TODO: use safeparse and make sure that the error is returned cleanly and formatted well
    const unverifiedTopLevelCommandOpts = program.opts();
    const topLevelCommandOptsOrErr = cliFlagsSchema.safeParse(
        unverifiedTopLevelCommandOpts
    );

    if (!topLevelCommandOptsOrErr.success) {
        const zodErrorMessage = zodErrorToMessage(topLevelCommandOptsOrErr.error);
        return new ParseCLIError(
            `Error parsing top-level CLI options: ${zodErrorMessage}`
        );
    }
    const topLevelCommandOpts = topLevelCommandOptsOrErr.data;

    if (!subCmdCommanderContext) {
        return new ParseCLIError(`No subcommand specified`);
    }

    const subCommandArgs = subCmdCommanderContext.subCmdArgs;
    const cliParserSubCommand = subCmdCommanderContext.subCmd;
    cliParserSubCommand.parse(subCommandArgs, {from: "user"});
    const unverifiedSubCommandOpts = cliParserSubCommand.opts();

    if (unverifiedSubCommandOpts.help) {
        //|| shouldShowHelpForEmptyCommand) {
        return {helpText: cliParserSubCommand.helpInformation()};
    }

    const subCommandConstructor =
        subCommandNameToConstructorAndParser[cliParserSubCommand.name()];

    const subCommandContext: SubCommandContext = {
        scriptContext,
        topLevelCommandOpts,
        unverifiedSubCommandOpts,
        subCommandArgs,
        subCommandConstructor,
    };

    return subCommandContext;
}
