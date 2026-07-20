/** Pack pptxgenjs output into a validated Blob (handles all export shapes). */

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

function isZipHeader(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

export async function packPptxBlob(pptx: import("pptxgenjs").default): Promise<Blob> {
  const out = await pptx.write({ outputType: "blob" });

  let blob: Blob;
  if (out instanceof Blob) {
    blob = out;
  } else if (out instanceof ArrayBuffer) {
    blob = new Blob([out], { type: PPTX_MIME });
  } else if (out instanceof Uint8Array) {
    blob = new Blob([out], { type: PPTX_MIME });
  } else if (typeof out === "string") {
    const binary = atob(out);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    blob = new Blob([bytes], { type: PPTX_MIME });
  } else {
    throw new Error("PPTX pack returned unsupported type");
  }

  if (blob.size < 256) {
    throw new Error("PPTX pack produced empty file");
  }

  const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  if (!isZipHeader(head)) {
    throw new Error("PPTX pack produced invalid ZIP data");
  }

  return blob;
}
