import {Configuration, CreateCompletionResponse, OpenAIApi} from "openai";
import * as axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import wtf from "wtfnode";
import {IncomingMessage} from "http";

dotenv.config();

function write(stream: any, data: string): Promise<void> {
    if (!stream.write(data)) {
        return new Promise((resolve) => stream.once("drain", resolve));
    } else {
        return Promise.resolve();
    }
}

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey === undefined) {
        throw new Error("API key not set");
    }

    const configuration = new Configuration({apiKey});
    const openai = new OpenAIApi(configuration);

    const controller = new AbortController();

    const resp: axios.AxiosResponse<CreateCompletionResponse> = await openai.createCompletion(
        {
            //model: "text-davinci-003",
            model: "text-curie-001",
            //model: "text-babbage-001",
            //model: "text-ada-001",
            prompt: "Count to 40: ",
            stream: true,
            max_tokens: 1000,
        },
        {responseType: "stream", signal: controller.signal}
    );

    const stream = resp.data as unknown as IncomingMessage;

    //stream.emit("end");

    stream.on("data", async (chunk: string) => {
        const messages = chunk.toString().slice(6).trim().split("\n\ndata: ");

        messages.forEach(async (message) => {
            if (message === "\n") {
                return;
            }

            if (message.trim() === "[DONE]") {
                console.log();
                return;
            }

            try {
                const parsed = JSON.parse(message);
                process.stdout.write(parsed.choices[0].text);
                //write(process.stdout, parsed.choices[0].text);
            } catch (error) {
                console.error(
                    `An error occurred during OpenAI request: "${message}"`
                );
                console.log({error});
            }
        });
    });
}
main().catch(console.error);
