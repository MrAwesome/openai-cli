import {z} from "zod";
import commander from "commander";
import util from "util";
import fs from "fs";
import path from "path";
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);
const readFile = util.promisify(fs.readFile);

export function noop(...args: any[]) {}

export function nullGuard<T>(obj: T | undefined | null): obj is T {
    return obj !== undefined && obj !== null;
}

function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function propsToSnakeCase<T>(obj: Record<string, T>): Record<string, T> {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [toSnakeCase(key), value])
    );
}

export function zodSafeParseResultToValOrError<E extends Error, T>(
    safeParseResult: z.SafeParseReturnType<any, T>,
    errConstructor: new (message: string) => E
): T | E {
    if (!safeParseResult.success) {
        const {error} = safeParseResult;
        return new errConstructor(zodErrorToMessage(error));
    }
    return safeParseResult.data;
}

export function zodErrorToMessage(error: z.ZodError, depth = 0, unionDepth = 0): string {
    return error.issues
        .map((i) => zodIssueToMessage(i, depth))
        .join(`\n${"  ".repeat(depth)}`);
}

export function zodDefault<T extends z.ZodRawShape>(sc: z.ZodObject<T>, key: keyof T): ReturnType<T[keyof T]["_def"]["defaultValue"]> {
    return sc.shape[key]._def.defaultValue();
}

function prefix(depth: number): string {
    return "  ".repeat(depth);
}

function zodIssueToMessage(issue: z.ZodIssue, depth = 0, unionDepth = 0): string {
    if ("unionErrors" in issue) {
        depth += 1;
        unionDepth += 1;
        let output = "\nUnion Error (expected one of the following): [\n";
        output += prefix(depth);
        output +=
            issue.unionErrors
                .map((e) => `{\n${prefix(depth)}`
                     + zodErrorToMessage(e, depth, unionDepth)
             + `\n${prefix(depth)}},`)
                .join(`\n${prefix(depth)}`);
        output += "\n]";
        return output;
    }
    if (unionDepth > 0) {
        console.log("unionDepth > 0");
    }
    return `${"  ".repeat(depth)} ${issue.path.join(".")}: ${issue.message}`;
}

export function myParseInt(value: any, dummyPrevious: any) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new commander.InvalidArgumentError("Not a number.");
    }
    return parsedValue;
}

// <debugging>
function stringifyWithCircularCheck(obj: any, space?: string | number): string {
    const seen: any[] = [];
    return JSON.stringify(
        obj,
        (key, val) => {
            if (val !== null && typeof val === "object") {
                if (seen.includes(val)) {
                    return "[Circular]";
                }
                seen.push(val);
            }
            return val;
        },
        space
    );
}

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type Literal = z.infer<typeof literalSchema>;
type Json = Literal | {[key: string]: Json} | Json[];
export const jsonSchema: z.ZodType<Json> = z.lazy(() =>
    z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);

export async function debugData(label: string, data: any) {
    console.log("[DEBUG]:", {label, data});
    // TODO: better location, not just /tmp (can be in a throwaway dir in the project)
    const debugDir = "debug/";
    await mkdir(debugDir, {recursive: true});
    // TODO: more generalized error handling
    const filename = path.join(debugDir, `${label}.json`);
    await writeFile(filename, stringifyWithCircularCheck(data, 2));
    console.log(`[DEBUG] Debug output written to ${filename}`);
}
// </debugging>

export async function getFileContents(
    relativeFilename: string
): Promise<string> {
    let prefix = "";
    if (path.parse(relativeFilename).root === "") {
        prefix = process.env.INIT_CWD || process.cwd();
    }
    const filename = path.join(prefix, relativeFilename);
    return await readFile(filename, "utf8");
}
