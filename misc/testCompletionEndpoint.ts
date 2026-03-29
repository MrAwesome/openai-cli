import {debugData} from "../src/utils";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

(async () => {
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await client.completions.create({
        model: "davinci-002",
        prompt: "Say this is a test",
        max_tokens: 7,
        temperature: 0,
        logprobs: 5,
    });
    await debugData("testCompletion", response);
})();
