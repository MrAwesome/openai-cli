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
        for (const key in result.category_scores) {
            const scoreKey = key as keyof typeof result.category_scores;
            const isKey =  key as keyof typeof result.categories;
            const score = result.category_scores[scoreKey];
            const isCat = result.categories[isKey];
            console.log(`${scoreKey}: ${score.toFixed(2)} ${isCat ? "!!! " : ""}`);
        }
    }
})();
