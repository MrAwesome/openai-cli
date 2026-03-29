import OpenAI from "openai";
import dotenv from "dotenv";
import wtf from "wtfnode";

dotenv.config();

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey === undefined) {
        throw new Error("API key not set");
    }

    const client = new OpenAI({apiKey});

    const stream = await client.completions.create({
        model: "davinci-002",
        prompt: "Count to 40: ",
        stream: true,
        max_tokens: 1000,
    });

    for await (const chunk of stream) {
        const text = chunk.choices[0]?.text;
        if (text) {
            process.stdout.write(text);
        }
    }
    console.log();
}

main().catch(console.error);
