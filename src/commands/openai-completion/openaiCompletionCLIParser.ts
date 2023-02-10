import {myParseInt} from '../../utils';
import {SCRIPT_DEFAULTS, OPENAI_COMPLETION_DEFAULTS} from '../../defaultSettings';

import commander from "commander";

export function openaiCompletionCLIParser(subCommand: commander.Command) {
    const {
        frequency_penalty,
        prompt_flag,
        max_tokens,
        model,
        repeat,
        temperature,
        logit_bias,
        top_p,
        presence_penalty,
        stream,
        echo,
        stop,
        user,
        best_of,
        prompt_file,
        trim,
    } = OPENAI_COMPLETION_DEFAULTS;

    // TODO: replace the "The <thing> to use" with the actual description from the openai docs.
    return subCommand

        .option('-f, --prompt_file <prompt_file>', `A file whose contents should be read and used as the OpenAI completion prompt. Mutually exclusive with --prompt or passing args as the prompt.`, prompt_file)
        // TODO: explain frequency/presence
        .option('-F, --frequency-penalty <frequency_penalty>', `The frequency penalty to use.`, parseFloat, frequency_penalty)
        .option('-P, --presence-penalty <presence_penalty>', `The presence penalty to use.`, parseFloat, presence_penalty)
        .option('-M, --max-tokens <max_tokens>', `The max tokens to use *for the total completion, including the prompt and response*.`, myParseInt, max_tokens)
        .requiredOption('-m, --model <model>', `The model to use.`, model)
        .option('-r, --repeat <n>', `How many times to repeat the prompt to the model. Careful using large values, as this can quickly eat through the API quota.`, myParseInt, repeat)
        .option('-t, --temperature <temperature>', `The temperature to use.`, parseFloat, temperature)
        .option('-p, --prompt', `The prompt to use.`, prompt_flag)

        // Currently <unused>:
        .option('-b, --best-of <best_of>', `The number of choices to generate and then choose from.`, myParseInt, best_of)
        .option('-e, --echo', `Echo the prompt back before the completion.`, echo)
        .option('-L, --logit-bias <logit_bias>', `The logit bias to use.`, logit_bias)
        // NOTE: the api actually supports an array here too, up to four elements
        .option('-S, --stop <stop>', `The stop sequence to use.`, stop)
        .option('-s, --stream', `Stream the response.`, stream)
        .option('-T, --top-p <top_p>', `The top-p to use. Not recommended to alter both top_p and temperature at the same time.`, parseFloat, top_p)
        .option('-u, --user <user>', `The user to use.`, user)
        // TODO: Actually, should prompts end with <|endoftext|> or \n? I'm not sure the difference, should read up on that.
        .option('-x, --trim', 'By default, a newline is added to the prompt sent to the model. This option removes that newline. Responses with this option will not be as likely to feel like conversations, but will be quite good at finishing a particular sentence/phrase/thought.', trim)

        // Unused, as they don't add anything to the functionality of a CLI:
        //.option('-l, --logprobs <logprobs>', `Whether to log probability thresholds`, parseFloat, logprobs)


        .arguments('[prompt...]');
}
