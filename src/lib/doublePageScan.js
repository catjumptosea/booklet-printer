import { PDFDocument } from 'pdf-lib';
import { loadPdfDoc } from './pdfjs';
import {
  computeRenderScale,
  embedCanvasCentered,
  releaseCanvas,
  renderPageToCanvas,
  splitCanvas,
} from './splitScan';

export async function processDoublePageScan(pdfBytes, onProgress = () => {}) {
  const srcDoc = await loadPdfDoc(pdfBytes.slice());
  const pageCount = srcDoc.numPages;
  if (!pageCount) {
    throw new Error('PDF 没有任何页面');
  }

  // 首个对开页拆出封面与封底，中间页按左页、右页顺序输出。
  const sequence = [{ index: 0, side: 'right' }];
  for (let index = 1; index < pageCount; index += 1) {
    sequence.push({ index, side: 'left' });
    sequence.push({ index, side: 'right' });
  }
  sequence.push({ index: 0, side: 'left' });

  const pageMeta = [];
  let maxHalfWidthPt = 1;
  let maxHeightPt = 1;

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await srcDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    const halfWidth = pageWidth / 2;
    pageMeta.push({
      page,
      pageWidth,
      pageHeight,
      halfWidth,
      halves: null,
      scale: computeRenderScale(pageWidth, pageHeight, { x: 0, y: 0, w: pageWidth, h: pageHeight }, undefined, undefined),
    });
    maxHalfWidthPt = Math.max(maxHalfWidthPt, halfWidth);
    maxHeightPt = Math.max(maxHeightPt, pageHeight);
  }

  const outDoc = await PDFDocument.create();
  for (let i = 0; i < sequence.length; i += 1) {
    onProgress({ phase: 'process', current: i + 1, total: sequence.length });
    const { index, side } = sequence[i];
    const meta = pageMeta[index];
    if (!meta.halves) {
      const canvas = await renderPageToCanvas(meta.page, meta.scale);
      meta.halves = splitCanvas(canvas);
      releaseCanvas(canvas);
    }
    const halfCanvas = side === 'left' ? meta.halves[0] : meta.halves[1];
    await embedCanvasCentered(
      outDoc,
      halfCanvas,
      meta.halfWidth,
      meta.pageHeight,
      maxHalfWidthPt,
      maxHeightPt,
    );
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
