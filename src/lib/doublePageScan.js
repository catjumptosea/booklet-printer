import { PDFDocument } from 'pdf-lib';
import { appendNormalizedPage, embedWholePage } from './pageNormalize.js';
import { getPageRotation } from './pageGeometry.js';

const LEFT_HALF = { left: 0, top: 0, width: 0.5, height: 1 };
const RIGHT_HALF = { left: 0.5, top: 0, width: 0.5, height: 1 };

export async function processDoublePageScan(pdfBytes, onProgress = () => {}) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const pageCount = srcDoc.getPageCount();
  if (!pageCount) {
    throw new Error('PDF 没有任何页面');
  }

  // 第一页的左半是封底、右半是封面；中间页按左、右顺序输出。
  const sequence = [{ index: 0, crop: RIGHT_HALF }];
  for (let index = 1; index < pageCount; index += 1) {
    sequence.push({ index, crop: LEFT_HALF });
    sequence.push({ index, crop: RIGHT_HALF });
  }
  sequence.push({ index: 0, crop: LEFT_HALF });

  const pageMeta = [];
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = srcDoc.getPage(pageIndex);
    const { width: rawWidth, height: rawHeight } = page.getSize();
    pageMeta.push({
      page,
      rawWidth,
      rawHeight,
      rotation: getPageRotation(page),
    });
  }

  const outDoc = await PDFDocument.create();
  const embeddedPages = new Map();
  for (let index = 0; index < sequence.length; index += 1) {
    onProgress({ phase: 'process', current: index + 1, total: sequence.length });
    const { index: pageIndex, crop } = sequence[index];
    const meta = pageMeta[pageIndex];
    if (!embeddedPages.has(meta)) {
      embeddedPages.set(meta, await embedWholePage(outDoc, meta.page));
    }
    await appendNormalizedPage(outDoc, meta, crop, embeddedPages.get(meta));
  }

  onProgress({ phase: 'build' });
  const pdfData = await outDoc.save();
  return {
    blob: new Blob([pdfData], { type: 'application/pdf' }),
    info: {
      originalPages: pageCount,
      splitCount: pageCount,
      resultPages: sequence.length,
    },
  };
}
