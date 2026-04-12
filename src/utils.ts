import {z} from "zod";
import type {ZodError} from "zod";
import type {$ZodIssue} from "zod/v4/core";
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
    safeParseResult: {success: true; data: T} | {success: false; error: ZodError},
    errConstructor: new (message: string) => E
): T | E {
    if (!safeParseResult.success) {
        const {error} = safeParseResult;
        return new errConstructor(zodErrorToMessage(error));
    }
    return safeParseResult.data;
}

export function zodErrorToMessage(error: ZodError): string {
    return error.issues.map((i) => formatZodIssue(i as $ZodIssue, 0)).join(`\n`);
}

function prefix(depth: number): string {
    return "  ".repeat(depth);
}

function formatZodIssue(issue: $ZodIssue, depth: number): string {
    if (issue.code === "invalid_union" && "errors" in issue && issue.errors.length > 0) {
        const branches = issue.errors.map((branch: $ZodIssue[], idx: number) => {
            const msgs = branch.map((i) => formatZodIssue(i, depth + 1)).join(`\n`);
            return `${prefix(depth + 1)}Branch ${idx + 1}:\n${msgs}`;
        });
        return `${prefix(depth)}Union (no branch matched):\n${branches.join(`\n`)}`;
    }
    if (issue.code === "invalid_key" && "issues" in issue) {
        const nested = issue.issues.map((i) => formatZodIssue(i, depth + 1)).join(`\n`);
        const p = issue.path?.length ? issue.path.join(".") : "(key)";
        return `${prefix(depth)}${p}: ${issue.message}\n${nested}`;
    }
    if (issue.code === "invalid_element" && "issues" in issue) {
        const nested = issue.issues.map((i) => formatZodIssue(i, depth + 1)).join(`\n`);
        const p = issue.path?.length ? issue.path.join(".") : "(element)";
        return `${prefix(depth)}${p}: ${issue.message}\n${nested}`;
    }
    const p = issue.path && issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${prefix(depth)}${p}: ${issue.message}`;
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

type Json = string | number | boolean | null | Json[] | {[key: string]: Json};
export const jsonSchema: z.ZodType<Json> = z.lazy((): z.ZodType<Json> =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(jsonSchema),
        z.record(z.string(), jsonSchema),
    ])
);

export async function debugData(label: string, data: any) {
    console.log("[DEBUG]:", {label, data});
    const debugDir = "debug/";
    await mkdir(debugDir, {recursive: true});
    const filename = path.join(debugDir, `${label}.json`);
    await writeFile(filename, stringifyWithCircularCheck(data, 2));
    console.log(`[DEBUG] Debug output written to ${filename}`);
}
// </debugging>

export function resolvePathUnderInitialCwd(
    initialCwd: string,
    relativeFilename: string,
): string {
    let prefix = "";
    if (path.parse(relativeFilename).root === "") {
        prefix = initialCwd;
    }
    return path.join(prefix, relativeFilename);
}

export async function getFileContents(
    initialCwd: string,
    relativeFilename: string,
): Promise<string> {
    const filename = resolvePathUnderInitialCwd(initialCwd, relativeFilename);
    return await readFile(filename, "utf8");
}

/** Resolve path like getFileContents, but return raw bytes (for images). */
export async function readBinaryFile(
    initialCwd: string,
    relativeFilename: string,
): Promise<Buffer> {
    const filename = resolvePathUnderInitialCwd(initialCwd, relativeFilename);
    return await readFile(filename);
}

/**
 * Best-effort image MIME type from file header. Returns null if unknown.
 */
export function inferImageMimeTypeFromMagicBytes(buf: Buffer): string | null {
    if (buf.length >= 8) {
        if (
            buf[0] === 0x89 &&
            buf[1] === 0x50 &&
            buf[2] === 0x4e &&
            buf[3] === 0x47 &&
            buf[4] === 0x0d &&
            buf[5] === 0x0a &&
            buf[6] === 0x1a &&
            buf[7] === 0x0a
        ) {
            return "image/png";
        }
    }
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
        return "image/jpeg";
    }
    if (
        buf.length >= 6 &&
        buf[0] === 0x47 &&
        buf[1] === 0x49 &&
        buf[2] === 0x46 &&
        buf[3] === 0x38 &&
        (buf[4] === 0x37 || buf[4] === 0x39)
    ) {
        return "image/gif";
    }
    if (buf.length >= 12) {
        const riff = buf.subarray(0, 4).toString("ascii");
        const webp = buf.subarray(8, 12).toString("ascii");
        if (riff === "RIFF" && webp === "WEBP") {
            return "image/webp";
        }
    }
    if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) {
        return "image/bmp";
    }
    return null;
}

export function getUnixTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}
