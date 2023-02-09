import {z} from 'zod';
import commander from 'commander';
import util from 'util';
import fs from 'fs';
import path from 'path';
const writeFile = util.promisify(fs.writeFile);
const mkdir = util.promisify(fs.mkdir);

export function noop(...args: any[]) {}

function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function propsToSnakeCase<T>(obj: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(obj).map(([key, value]) => [toSnakeCase(key), value]));
}

export function zodSafeParseResultToValOrError<E extends Error, T>(safeParseResult: z.SafeParseReturnType<any, T>, errConstructor: new (message: string) => E): T | E {
    if (!safeParseResult.success) {
        const {error} = safeParseResult;
        return new errConstructor(zodErrorToMessage(error));
    }
    return safeParseResult.data;
}

export function zodErrorToMessage(error: z.ZodError): string {
    return error.issues.map((e) => (`${e.path.join(".")}: ${e.message}`)).join('\n');
}

export function myParseInt(value: any, dummyPrevious: any) {
    const parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue)) {
        throw new commander.InvalidArgumentError('Not a number.');
    }
    return parsedValue;
}

// <debugging>
function stringifyWithCircularCheck(obj: any, space?: string | number): string {
    const seen: any[] = [];
    return JSON.stringify(obj, (key, val) => {
        if (val !== null && typeof val === 'object') {
            if (seen.includes(val)) {
                return '[Circular]';
            }
            seen.push(val);
        }
        return val;
    }, space);
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
