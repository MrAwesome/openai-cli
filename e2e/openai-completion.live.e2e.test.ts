import CLIRunner from "../src/CLIRunner";
import type {ScriptContext} from "../src/types";
import dotenv from "dotenv";

dotenv.config();

jest.setTimeout(180000);

type CompletionCase = {
    name: string;
    provider: "openai" | "gemini";
    model?: string;
    extraArgs?: string[];
};

const SUCCESS_WORD = "TEST_SUCCESS";
const PROMPT = `Reply with only the word ${SUCCESS_WORD}.`;

function hasAPIKeyForProvider(provider: "openai" | "gemini"): boolean {
    if (provider === "gemini") {
        return (process.env.GEMINI_API_KEY ?? "").length > 0;
    }
    return (process.env.OPENAI_API_KEY ?? "").length > 0;
}

async function runCompletion(args: string[]) {
    const scriptContext: ScriptContext = {
        isRemote: false,
        repoBaseDir: __dirname,
        initialCwd: process.cwd(),
        rawArgs: ["node", "openai-cli", "openai-completion", ...args],
    };
    const runner = new CLIRunner(scriptContext);
    return runner.run();
}

const testCases: CompletionCase[] = [
    {
        name: "openai default cheap model",
        provider: "openai",
        extraArgs: ["--temperature", "0", "--max-tokens", "8"],
    },
    {
        name: "openai explicit gpt-5-mini",
        provider: "openai",
        model: "gpt-5-mini",
        extraArgs: ["--temperature", "0", "--top-p", "1"],
    },
    {
        name: "openai explicit gpt-4o-mini",
        provider: "openai",
        model: "gpt-4o-mini",
        extraArgs: ["--temperature", "0", "--max-tokens", "8"],
    },
    {
        name: "gemini default fallback-capable",
        provider: "gemini",
        extraArgs: ["--temperature", "0", "--max-tokens", "8"],
    },
    {
        name: "gemini explicit 2.5 flash",
        provider: "gemini",
        model: "gemini-2.5-flash",
        extraArgs: ["--temperature", "0", "--max-tokens", "8"],
    },
    {
        name: "gemini explicit 2.0 flash",
        provider: "gemini",
        model: "gemini-2.0-flash",
        extraArgs: ["--temperature", "0", "--top-p", "1"],
    },
];

describe("live provider e2e completion", () => {
    test.each(testCases)("$name", async (tc) => {
        if (!hasAPIKeyForProvider(tc.provider)) {
            console.warn(`Skipping ${tc.name}: missing API key for provider ${tc.provider}.`);
            return;
        }

        const args = ["--provider", tc.provider];
        if (tc.model !== undefined) {
            args.push("--model", tc.model);
        }
        if (tc.extraArgs !== undefined) {
            args.push(...tc.extraArgs);
        }
        args.push(PROMPT);

        const res = await runCompletion(args);
        expect(res.status).toBe("success");
        if (res.status !== "success") {
            throw new Error(`Unexpected non-success status: ${res.status}`);
        }

        expect(res.output.trim()).toBe(SUCCESS_WORD);
    });
});
