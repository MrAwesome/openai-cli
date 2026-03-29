import path from "path";

/**
 * Resolves output paths for generated images. Single file uses `output` as-is
 * (adds defaultExtension if there is no extension). Multiple images use
 * `<name>-1.ext`, etc.
 */
export function deriveImageOutputPaths(
    output: string,
    count: number,
    initialCwd: string,
    defaultExtension: string,
): string[] {
    let normalized = output.trim();
    if (normalized.length === 0) {
        normalized = `image${defaultExtension}`;
    } else if (path.extname(normalized) === "") {
        normalized += defaultExtension;
    }

    const absolute = path.isAbsolute(normalized)
        ? path.normalize(normalized)
        : path.join(initialCwd, normalized);

    if (count === 1) {
        return [absolute];
    }

    const {dir, name, ext} = path.parse(absolute);
    const extension = ext || defaultExtension;
    return Array.from({length: count}, (_, i) =>
        path.join(dir, `${name}-${i + 1}${extension}`)
    );
}
