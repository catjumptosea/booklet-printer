import { PDFDocument } from 'pdf-lib';
import { shouldSplitPage } from './mixedPageRules.js';
import { appendNormalizedPage, embedWholePage } from './pageNormalize.js';
import {
  getPageRotation,
  getRotatedSize,
} from './pageGeometry.js';

const LEFT_HALF = { left: 0, top: 0, width: 0.5, height: 1 };
const RIGHT_HALF = { left: 0.5, top: 0, width: 0.5, height: 1 };

export async function processSplitScan(pdfBytes, onProgress = () => {}) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const pageCount = srcDoc.getPageCount();
  if (!pageCount) {
    throw new Error('PDF 没有任何页面');
  }

  const pageMeta = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    onProgress({ phase: 'validate', current: pageIndex + 1, total: pageCount });
    const page = srcDoc.getPage(pageIndex);
    const { width: rawWidth, height: rawHeight } = page.getSize();
    const rotation = getPageRotation(page);
    const displaySize = getRotatedSize(rawWidth, rawHeight, rotation);
    pageMeta.push({
      page,
      rawWidth,
      rawHeight,
      rotation,
      displaySize,
    });
  }

  const outputs = [];
  let splitCount = 0;
  for (const meta of pageMeta) {
    if (shouldSplitPage(meta.displaySize)) {
      splitCount += 1;
      outputs.push({ meta, crop: LEFT_HALF });
      outputs.push({ meta, crop: RIGHT_HALF });
    } else {
      outputs.push({ meta, crop: null });
    }
  }

  const outDoc = await PDFDocument.create();
  const embeddedPages = new Map();
  for (let index = 0; index < outputs.length; index += 1) {
    onProgress({ phase: 'process', current: index + 1, total: outputs.length });
    const output = outputs[index];
    if (!embeddedPages.has(output.meta)) {
      embeddedPages.set(output.meta, await embedWholePage(outDoc, output.meta.page));
    }
    await appendNormalizedPage(outDoc, output.meta, output.crop, embeddedPages.get(output.meta));
  }

  onProgress({ phase: 'build' });
  const pdfData = await outDoc.save();
  return {
    blob: new Blob([pdfData], { type: 'application/pdf' }),
    info: {
      originalPages: pageCount,
      splitCount,
      resultPages: outputs.length,
    },
  };
}
