import {
    apiKeyNotSetErrorForProvider,
    defaultEndpointForProvider,
    normalizeProvider,
    type KnownProvider,
    providerAPIKeyEnvVar,
} from "./defaultSettings";
import {APIKeyNotSetError, SubCommand} from "./types";
import {APIError} from "openai";
import dotenv from "dotenv";

dotenv.config();

class ProviderAPIKeyNotSetError extends APIKeyNotSetError {
    constructor(provider: KnownProvider) {
        super(apiKeyNotSetErrorForProvider(provider));
    }
}

export default abstract class OpenAICommand<Opts> extends SubCommand<Opts> {
    protected getProvider(verifiedOpts: {provider?: string}): KnownProvider {
        return normalizeProvider(verifiedOpts.provider);
    }

    protected getAPIKey(provider: KnownProvider): string | APIKeyNotSetError {
        const apiKey = process.env[providerAPIKeyEnvVar(provider)];
        if (apiKey === undefined) {
            return new ProviderAPIKeyNotSetError(provider);
        }
        return apiKey;
    }

    protected resolveBaseURL(
        provider: KnownProvider,
        endpoint: string | undefined,
        local: boolean | undefined,
    ): string | undefined {
        if (endpoint !== undefined) {
            return endpoint;
        }
        if (local) {
            return "http://localhost:8080/v1";
        }
        return defaultEndpointForProvider(provider);
    }

    protected sanitizeAndFormatOpenAIAPIError(e: any, apiKey: string): string {
        const {scriptContext} = this.ctx;

        let message: string;
        if (e instanceof APIError) {
            message = e.message;
        } else if (e?.isAxiosError && e?.response?.data?.error?.message) {
            message = e.response.data.error.message;
        } else {
            message = e?.message ?? String(e);
        }

        if (scriptContext.isRemote && apiKey !== undefined) {
            if (message.includes(apiKey) || message.toLowerCase().includes("api key")) {
                console.error("[ERROR] API key was included in error message! Censoring. Error:", e.message, e);

                message = `[ERROR] Something is wrong with the API key. Please contact the server administrator and let them know: ${scriptContext.serverAdminContactInfo}`;
            }
        }
        return message;
    }
}
