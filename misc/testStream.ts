import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey === undefined) {
        throw new Error("API key not set");
    }

    const client = new OpenAI({apiKey});
    const model =
        process.env.DEFAULT_OPENAI_COMPLETION_MODEL ?? "gpt-4o-mini";

    const stream = await client.chat.completions.create({
        model,
        messages: [{role: "user", content: "Count to 40: "}],
        stream: true,
        max_completion_tokens: 1000,
    });

    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
            process.stdout.write(text);
        }
    }
    console.log();
}

main().catch(console.error);
