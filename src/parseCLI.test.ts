// test the code from ./src/parseCLI.ts

//import {parseCLI} from "./parseCLI";
//import jest from "jest";
//
//// TODO: add 'null' or 'upstream' to force using the API's default for certain values
//// TODO: default values file
//
//test("parseCLI", () => {
//    const {scriptOpts, openaiOpts, args} = parseCLI(["node", "src/index.js", "--model", "ada", "This is a prompt."]);
//    expect(scriptOpts).toEqual({
//        file: undefined,
//        debug: false,
//    });
//    expect(openaiOpts).toEqual({
//        api_key: undefined,
//        model: "ada",
//        temperature: 0.5,
//        echo: true,
//        max_tokens: 64,
//        repeat: 1,
//        frequency_penalty: 0,
//    });
//    expect(args).toEqual(["This is a prompt."]);
//});
