import {z} from 'zod';
import commander from 'commander';
import {propsToSnakeCase} from './utils';

const DEFAULT_OPENAI_MODEL = 'text-davinci-003';

// TODO: translation layer between what commander gives us and what openai expects
// TODO: better ensure that all of these which are explicitly required are actually required

const scriptOptionsSchema = z.object({
    file: z.string().optional(),
    debug: z.boolean().optional(),
    help: z.boolean().optional(), // TODO: unused
    version: z.boolean().optional(), // TODO: unused
    trim: z.boolean().optional(), // TODO: unused
}).strip();

type ScriptOptions = z.infer<typeof scriptOptionsSchema>;

// TODO: use refine to enforce the parameters from the openai docs
const openAIOptionsSchema = z.object({
    model: z.string().default(DEFAULT_OPENAI_MODEL),
    api_key: z.string({required_error: `
[ERROR] OPENAI_API_KEY environment variable not set. 
Step 1) Go to https://beta.openai.com/account/api-keys to get an API key.
Step 2) Open the file .env in the root of this project, and add the following line, without the angle brackets:
OPENAI_API_KEY=<your API key>
        `.trim()}),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
    frequency_penalty: z.number().optional(),
    repeat: z.number().optional(),
    echo: z.boolean().optional(),
    stop: z.string().optional(), // TODO: unused
    choice: z.number().optional(), // TODO: unused
    log_probability_threshold: z.number().optional(), // TODO: unused
    best_of: z.number().optional(), // TODO: unused
    user: z.string().optional(), // TODO: unused
    top_p: z.number().optional(), // TODO: unused
    stream: z.boolean().optional(), // TODO: unused
    presence_penalty: z.number().optional(), // TODO: unused
    prompt: z.string().optional(), // TODO: unused
    suffix: z.string().optional(), // TODO: unused
}).strip();

type OpenAIOptions = z.infer<typeof openAIOptionsSchema>;


type PreVerifiedOptions = Partial<ScriptOptions> & Partial<OpenAIOptions>;

export class CommandLineParseError extends Error {}

export function parseCLI(rawArgs: string[]): {scriptOpts: ScriptOptions, openaiOpts: OpenAIOptions, args: string[]} {
    const program = new commander.Command();

    // TODO: decide which of these values should be set to their defaults here and which should just be undefined and set upstream (probably all of them should be set upstream)
    const parser = program
        .option('-a, --api-key <api_key>', 'The API key to use. Defaults to OPENAI_API_KEY environment variable. Not recommended to set this directly using this flag, unless you do something like `-a "$(cat .openai_api_key)" to avoid having the API key in your shell history.', process.env.OPENAI_API_KEY)
        .option('-f, --file <file>', 'The file to use. Defaults to none')
        .option('-F, --frequency-penalty <frequency_penalty>', 'The frequency penalty to use. Defaults to 0.0', parseFloat, 0.0)
        .option('-M, --max-tokens <max_tokens>', 'The max tokens to use *for the total completion, including the prompt and response*. Defaults to 1024', parseInt, 1024)
        .requiredOption('-m, --model <model>', 'The model to use. Defaults to text-davinci-003', DEFAULT_OPENAI_MODEL)
        .option('-n, --num-tokens <num_tokens>', 'The number of tokens to generate. Defaults to 1024', parseInt, 1024)
        .option('-r, --repeat <repeat>', 'How many times to repeat the prompt to the model. Careful using large values, as this can quickly eat through your quota. Defaults to 1.', parseInt, 1)
        .option('-t, --temperature <temperature>', 'The temperature to use. Defaults to 0.6', parseFloat, 0.6)

        // Currently unused:
        .option('-b, --best-of <best_of>', 'The number of choices to generate and then choose from. Defaults to 1', parseInt, 1)
        .option('-c, --choice <choice>', 'The choice to use. Defaults to 0', parseInt, 0)
        .option('-d, --debug', 'Enable debug mode')
        .option('-e, --echo', 'Echo the prompt back before the completion. Defaults to false', false)
        .option('-l, --log-probability-threshold <log_probability_threshold>', 'The log probability threshold to use. Defaults to 0.0', parseFloat, 0.0)
        // NOTE: the api actually supports an array here too, up to four elements
        .option('-s, --stop <stop>', 'The stop sequence to use. Defaults to none')
        .option('-T, --top-p <top_p>', 'The top-p to use. Not recommended to alter both top_p and temperature at the same time. Defaults to 1.0', parseFloat, 1.0)
        .option('-u, --user <user>', 'The user to use. Defaults to none')
        .option('-v, --version', 'Display version')
        // TODO: Actually, should prompts end with <|endoftext|> or \n? I'm not sure the difference, should read up on that.
        .option('-x, --trim', 'By default, a newline is added to the prompt send to the model. This option removes that newline. Responses with this option will not be as likely to feel like conversations, but will be quite good at finishing a particular sentence/phrase/thought.')
        .option('-p, --prompt', 'The prompt to use. Defaults to <|endoftext|>', '<|endoftext|>')
        //  /unused

        .arguments('[prompt]')
        .addHelpCommand()
        .parse(rawArgs);

    const camelCasePreVerifiedOpts = parser.opts();

    const preVerifiedSnakeCaseOpts = propsToSnakeCase(camelCasePreVerifiedOpts);
    const scriptOpts = scriptOptionsSchema.parse(preVerifiedSnakeCaseOpts);
    const openaiOpts = openAIOptionsSchema.parse(preVerifiedSnakeCaseOpts);
    const args = parser.args;

    // TODO: don't return args, return prompt as part of openaiOpts

    return {scriptOpts, openaiOpts, args};
}
