import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const message = process.argv.slice(2).join(" ");

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    try {
        const completion = await client.chat.completions.create({
            model: "gpt-4o",
            messages: [{role: "user", content: message}],
        });
        console.log(completion.choices[0].message?.content);
    } catch (e: any) {
        console.log(e.message);
    }
}

main();
