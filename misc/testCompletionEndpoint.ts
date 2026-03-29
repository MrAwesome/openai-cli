import {debugData} from "../src/utils";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

(async () => {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const model =
        process.env.DEFAULT_OPENAI_COMPLETION_MODEL ?? "gpt-4o-mini";
    const response = await client.chat.completions.create({
        model,
        messages: [{role: "user", content: "Say this is a test"}],
        max_completion_tokens: 32,
        temperature: 0,
    });
    await debugData("testChatCompletion", response);
})();
