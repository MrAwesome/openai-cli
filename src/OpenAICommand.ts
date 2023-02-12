import {OPENAI_API_KEY_NOT_SET_ERROR} from "./defaultSettings";
import {APIKeyNotSetError, SubCommand} from "./types";
import dotenv from "dotenv";

dotenv.config();

class OpenAIAPIKeyNotSetError extends APIKeyNotSetError {
    constructor() {
        super(OPENAI_API_KEY_NOT_SET_ERROR);
    }
}

export default abstract class OpenAICommand<Opts> extends SubCommand<Opts> {
    protected getAPIKey(): string | APIKeyNotSetError {
        const apiKey = process.env.OPENAI_API_KEY;
        if (apiKey === undefined) {
            return new OpenAIAPIKeyNotSetError();
        }
        return apiKey;
    }

    protected sanitizeAndFormatOpenAIAPIError(e: any): string {
        const {scriptContext} = this.ctx;
        const openaiAPIKey = this.getAPIKey();
        let message = e.isAxiosError ? e.response.data.error.message : e.message;
        if (scriptContext.isRemote && openaiAPIKey !== undefined) {
            if (message.includes(openaiAPIKey) || message.toLowerCase().includes("api key")) {
                console.error("[ERROR] API key was included in error message! Censoring. Error:", e.message, e);

                message = `[ERROR] Something is wrong with the API key. Please contact the server administrator and let them know: ${scriptContext.serverAdminContactInfo}`;
            }
        }
        return message;
    }
}

