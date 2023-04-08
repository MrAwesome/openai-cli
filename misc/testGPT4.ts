import {Configuration, OpenAIApi} from "openai";
import dotenv from "dotenv";

dotenv.config();

async function main() {
    const message = process.argv.slice(2).join(" ");

    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);

    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [{role: "user", content: message}],
        });
        console.log(completion.data.choices[0].message?.content)
    } catch (e: any) {
        console.log(e.response.data.error.message);
    }
}

main();
