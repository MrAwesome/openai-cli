import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

(async () => {
    const hatefulContent = process.argv.slice(2).join(" ");
    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
    const response = await client.moderations.create({
        input: hatefulContent,
    });

    const results = response.results;

    for (const result of results) {
        for (const key in result.category_scores) {
            const scoreKey = key as keyof typeof result.category_scores;
            const isKey = key as keyof typeof result.categories;
            const score = result.category_scores[scoreKey];
            const isCat = result.categories[isKey];
            console.log(`${scoreKey}: ${score.toFixed(2)} ${isCat ? "!!! " : ""}`);
        }
    }
})();
