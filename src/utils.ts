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
