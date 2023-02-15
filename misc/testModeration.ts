import {Configuration, OpenAIApi} from "openai";
import dotenv from "dotenv";

dotenv.config();

(async () => {

    const hatefulContent = process.argv.slice(2).join(" ");
    const configuration = new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const openai = new OpenAIApi(configuration);
    const response = await openai.createModeration({
        input: hatefulContent,
    });

    const results = response.data.results;

    for (const result of results) {
        console.log(result.flagged);
        console.log(result.categories);
        console.log(result.category_scores);
    }
})();
