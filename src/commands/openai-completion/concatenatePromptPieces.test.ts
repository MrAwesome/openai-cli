import {OpenAICompletionCLIOptions, openaiCompletionCLIOptionsLOCALSchema, openaiCompletionCLIOptionsREMOTESchema} from "./validation";
import concatenatePromptPieces from "./concatenatePromptPieces";

const defaultRemoteOpts = openaiCompletionCLIOptionsREMOTESchema.parse({});
const defaultLocalOpts = openaiCompletionCLIOptionsLOCALSchema.parse({});

describe("concatenatePromptPieces", () => {
    it("should concatenate prompt pieces", () => {
        let opts: OpenAICompletionCLIOptions = {
            ...defaultRemoteOpts,
            promptFlag: "flag",
            promptPrefix: "prefix",
            promptSuffix: "suffix",
            trailingNewline: false,
            joiner: false,
        };

        const promptFileContents = "filecontents";

        const args: string[] = ["arg1", "arg2", "arg3"];

        expect(concatenatePromptPieces(args, opts, promptFileContents)).toEqual(
            "prefix\nflag\narg1 arg2 arg3\nfilecontents\nsuffix\n"
        );

        opts.promptJoiner = "|";
        expect(concatenatePromptPieces(args, opts, promptFileContents)).toEqual(
            "prefix|flag|arg1 arg2 arg3|filecontents|suffix\n"
        );

        opts.joiner = true;
        expect(concatenatePromptPieces(args, opts, promptFileContents)).toEqual(
            "prefixflagarg1 arg2 arg3filecontentssuffix\n"
        );

        opts.trailingNewline = true;
        expect(concatenatePromptPieces(args, opts, promptFileContents)).toEqual(
            "prefixflagarg1 arg2 arg3filecontentssuffix"
        );
    });

    it("should not product any prompt pieces for the default options", () => {
        const args: string[] = [];
        const remoteOpts = defaultRemoteOpts;
        expect(concatenatePromptPieces(args, remoteOpts, undefined)).toEqual("");

        const localOpts = defaultLocalOpts;
        expect(concatenatePromptPieces(args, localOpts, undefined)).toEqual("");
    });

    it.each`
        args                | optsDelta                                               | expected
        ${["arg1", "arg2"]} | ${{}}                                                   | ${"arg1 arg2\n"}
        ${["arg1", "arg2"]} | ${{promptPrefix: "prefix"}}                             | ${"prefix\narg1 arg2\n"}
        ${[]}               | ${{promptPrefix: "prefix"}}                             | ${"prefix\n"}
        ${[]}               | ${{promptSuffix: "suffix"}}                             | ${"suffix\n"}
        ${[]}               | ${{promptPrefix: "prefix", promptSuffix: "suffix"}}     | ${"prefix\nsuffix\n"}
        ${["arg1", "arg2"]} | ${{trailingNewline: true}}                              | ${"arg1 arg2"}
        ${["arg1", "arg2"]} | ${{joiner: true}}                                       | ${"arg1 arg2\n"}
        ${["arg1", "arg2"]} | ${{promptFlag: "flag", joiner: true}}                   | ${"flagarg1 arg2\n"}
        ${["arg1", "arg2"]} | ${{promptPrefix: "prefix", trailingNewline: true}}      | ${"prefix\narg1 arg2"}
        ${[]}               | ${{promptPrefix: "prefix", joiner: true}}               | ${"prefix\n"}
    `("should handle: $args $optsDelta", ({args, optsDelta, expected}) => {
        const remoteOpts = {
            ...defaultRemoteOpts,
            ...optsDelta,
        };
        const receivedRemote = concatenatePromptPieces(args, remoteOpts, undefined);

        const localOpts = {
            ...defaultLocalOpts,
            ...optsDelta,
        };
        const receivedLocal = concatenatePromptPieces(args, localOpts, undefined);

        if (receivedRemote !== expected) {
            console.log({args, optsDelta, expected, receivedRemote});
        }
        expect(receivedRemote).toEqual(expected);

        if (receivedLocal !== expected) {
            console.log({args, optsDelta, expected, receivedLocal});
        }

        expect(receivedLocal).toEqual(expected);
    });
});
