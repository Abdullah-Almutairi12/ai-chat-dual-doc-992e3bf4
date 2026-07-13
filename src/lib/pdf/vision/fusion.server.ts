import type { VisionBlock, VisionPage } from "@/lib/pdf/vision/schema";
import { textLayerToBlocks, type PageTextLayer } from "@/lib/pdf/vision/text-layer.server";
import { logMaster } from "@/lib/pdf/vision/validate.server";

function blockSortKey(b: VisionBlock): number {
  const y = b.layout?.y ?? 0.999;
  const x = b.layout?.x ?? 0;
  return y * 1000 + x;
}

export function sortBlocksByLayout(blocks: VisionBlock[]): VisionBlock[] {
  return [...blocks].sort((a, b) => blockSortKey(a) - blockSortKey(b));
}

function blocksMissingLayout(blocks: VisionBlock[]): boolean {
  if (!blocks.length) return true;
  const withLayout = blocks.filter((b) => b.layout?.x != null && b.layout?.y != null);
  return withLayout.length < blocks.length * 0.4;
}

/** Merge Vision AI output with PDF text-layer for Adobe-grade layout fidelity. */
export function fuseVisionWithTextLayer(
  aiPages: VisionPage[],
  textLayers: PageTextLayer[],
): VisionPage[] {
  const layerByPage = new Map(textLayers.map((l) => [l.pageNumber, l]));

  return aiPages.map((page) => {
    const layer = layerByPage.get(page.pageNumber);
    let blocks = sortBlocksByLayout(page.blocks);

    if (!blocks.length && layer?.boxes.length) {
      logMaster("fusion_text_layer_fallback", { page: page.pageNumber, boxes: layer.boxes.length });
      blocks = textLayerToBlocks(layer);
    } else if (layer && blocksMissingLayout(blocks) && layer.boxes.length) {
      logMaster("fusion_layout_enrich", { page: page.pageNumber, aiBlocks: blocks.length, hints: layer.boxes.length });
      const enriched = blocks.map((block, i) => {
        if (block.layout?.x != null && block.layout?.y != null) return block;
        const hint = layer.boxes[i] ?? layer.boxes.find((h) => h.text.includes(block.text?.slice(0, 12) ?? "___"));
        if (!hint) return block;
        return { ...block, layout: hint.layout, rtl: block.rtl ?? hint.rtl, fontSize: block.fontSize ?? hint.fontSize };
      });
      blocks = sortBlocksByLayout(enriched);
    } else {
      blocks = sortBlocksByLayout(blocks);
    }

    return { ...page, blocks };
  });
}
