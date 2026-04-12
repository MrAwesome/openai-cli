import {inferImageMimeTypeFromMagicBytes} from "./utils";

describe("inferImageMimeTypeFromMagicBytes", () => {
    it("returns null for empty buffer", () => {
        expect(inferImageMimeTypeFromMagicBytes(Buffer.alloc(0))).toBeNull();
    });

    it("detects PNG", () => {
        const header = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
        ]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBe("image/png");
    });

    it("detects JPEG", () => {
        const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBe("image/jpeg");
    });

    it("detects GIF87a", () => {
        const header = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBe("image/gif");
    });

    it("detects GIF89a", () => {
        const header = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBe("image/gif");
    });

    it("detects WebP", () => {
        const header = Buffer.concat([
            Buffer.from("RIFF", "ascii"),
            Buffer.alloc(4),
            Buffer.from("WEBP", "ascii"),
        ]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBe("image/webp");
    });

    it("detects BMP", () => {
        const header = Buffer.from([0x42, 0x4d, 0x00, 0x00]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBe("image/bmp");
    });

    it("returns null for unknown bytes", () => {
        const header = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]);
        expect(inferImageMimeTypeFromMagicBytes(header)).toBeNull();
    });
});
