import {z} from "zod";
import commander from "commander";
import {
    jsonSchema,
    myParseInt,
    propsToSnakeCase,
    zodErrorToMessage,
} from "./utils";

import {
    CLIHelp,
    SubCommandConstructor,
    ParseCLIError,
    SubCommand,
    SubCommandContext,
    ScriptContext,
} from "./types";
import OpenAICompletionCommand from "./commands/openai-completion/OpenAICompletionCommand";
import {DEFAULT_SUBCOMMAND_NAME, KnownSubCommandName, KNOWN_SUBCOMMAND_NAMES, KNOWN_SUBCOMMAND_NAMES_SET, SCRIPT_DEFAULTS} from "./defaultSettings";

// TODO: translation layer between what commander gives us and what openai expects
// TODO: better ensure that all of these which are explicitly required are actually required
// TODO: alias commands (e.g. "completion" for "openai-completion", "gpt" for "openai-completion", 
// TODO: specific alias commands ("codegen" "ts" etc) for specific prompts (figure out where to inject the prompts, or just disallow --prompt etc?)
// TODO: add a "prompt" subcommand which just prints out the prompt for a given subcommand
// TODO: support reading from stdin as a prompt source
// TODO: support sub-sub-commands ("codegen ts", "codegen js", "codegen python"?)

// TODO: determine if this should be used anywhere or if these are simple enough to just trust
const cliFlagsSchema = z
    .object({
        debug: z.boolean().optional(),
        help: z.boolean().optional(),
        version: z.boolean().optional(), // TODO: unused
    })
    .strip();

export type TopLevelCLIFlags = z.infer<typeof cliFlagsSchema>;

const subCommandConstructors: SubCommandConstructor<any>[] = [
    OpenAICompletionCommand,
];
export default function parseCLI(
    scriptContext: ScriptContext,
): SubCommand<any> | CLIHelp | ParseCLIError {
    const rawArgs = scriptContext.rawArgs;
    const {debug, help, version} = SCRIPT_DEFAULTS;
    const program = new commander.Command()
        .option('-d, --debug', `Enable debug mode`, debug)
        .option('-v, --version', `Display version`, version)

    // TODO: generate unit tests for:
    // - each subcommand's CLI parser
    // help command
    // --help
    //


    const subCommandNameToConstructorAndParser: Record<
        string,
        {
            subCommandConstructor: SubCommandConstructor<any>;
            cliParserSubCommand: commander.Command;
        }
    > = Object.fromEntries(
        subCommandConstructors.map((subCommandConstructor) => [
            subCommandConstructor.subCommandName,
            // NOTE: this both constructs the subcommand parser and adds it to the program
            {
                subCommandConstructor,
                cliParserSubCommand:
                    subCommandConstructor.addSubCommandTo(program),
            },
        ])
    );

    let subCommandName: KnownSubCommandName;
    let fixedArgs: string[];
    let subCommandArgs: string[];

    // Manually remove 'node' and the script name from the args if it's a local run.
    // Normally, commander handles this for us
    const justArgs = scriptContext.isRemote ? rawArgs : rawArgs.slice(2);

    // If there are no args, then we're running the default subcommand
    if (rawArgs.length === 0) {
        fixedArgs = [DEFAULT_SUBCOMMAND_NAME];
        subCommandName = DEFAULT_SUBCOMMAND_NAME;
        subCommandArgs = [];
    } else {
        const possibleSubCommandName = rawArgs[0];

        if (KNOWN_SUBCOMMAND_NAMES_SET.has(possibleSubCommandName as KnownSubCommandName)) {
            // If there are args, and the first arg is a known subcommand,
            //     then we're running that subcommand
            fixedArgs = rawArgs;
            subCommandName = possibleSubCommandName as KnownSubCommandName;
            subCommandArgs = rawArgs.slice(1);
        } else {
            // If there are args, and the first arg is not a known subcommand,
            //     then we're running the default subcommand
            fixedArgs = [DEFAULT_SUBCOMMAND_NAME, ...rawArgs];
            subCommandName = DEFAULT_SUBCOMMAND_NAME;
            subCommandArgs = rawArgs;
        }
    }

    const parseOptions: commander.ParseOptions = {
        from: 'user',
    };

    // For local (terminal) runs, we're fine with the default behavior,
    // but for remote runs, we want to catch CLI parsing errors and send them along the wire
    let helpText = "";
    if (scriptContext.isRemote) {
        // TODO: register a callback here? this throws.
        program.exitOverride();
        //program.helpOption(false);
        program.outputHelp = (helpContext) => {helpText = program.helpInformation();};
        //program.option('-h, --help', `Display help`, help);
    }

    try {
        program.parse(fixedArgs, parseOptions);
    } catch (err) {
        if (helpText) {
            return {helpText};
        } else {
            throw err;
        }
    }

    const opts = program.opts();
    //NOTE: can zod parse opts here using cliFlagsSchema

    const args = program.args;

    if (opts.help) {
        return {helpText: program.helpInformation()};
    }

    const {subCommandConstructor, cliParserSubCommand} = subCommandNameToConstructorAndParser[subCommandName];

    const topLevelCommandOpts = program.opts();
    const subCommandOpts = cliParserSubCommand.opts();

    if (subCommandOpts.help) {
        return {helpText: cliParserSubCommand.helpInformation()};
    }

    const subCommandContext: SubCommandContext = {
        scriptContext,
        topLevelCommandOpts,
        subCommandOpts,
        subCommandArgs,
    };

    const subCommand = new subCommandConstructor(subCommandContext);
    return subCommand;
}
