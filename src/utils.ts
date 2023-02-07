import type {z} from 'zod';
import commander from 'commander';

export function stringifyWithCircularCheck(obj: any, space?: string | number): string {
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
