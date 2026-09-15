import { PDFDocument } from 'pdf-lib';
import { loadPdfDoc } from './pdfjs';
import {
  computeSinglePageBaseline,
  shouldSplitPage,
} from './mixedPageRules.js';

const TARGET_LONG_EDGE = 2400;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;
const JPEG_QUALITY = 0.92;

export function canvasToBlob(canvas, type = 'image/jpeg', quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to Blob failed'))),
      type,
      quality,
    );
  });
}

export function splitCanvas(source) {
  const leftWidth = Math.floor(source.width / 2);
  const rightWidth = source.width - leftWidth;

  const left = document.createElement('canvas');
  left.width = leftWidth;
  left.height = source.height;
  left.getContext('2d').drawImage(
    source, 0, 0, leftWidth, source.height, 0, 0, leftWidth, source.height,
  );

  const right = document.createElement('canvas');
  right.width = rightWidth;
  right.height = source.height;
  right.getContext('2d').drawImage(
    source, leftWidth, 0, rightWidth, source.height, 0, 0, rightWidth, source.height,
  );

  return [left, right];
}

export function computeRenderScale(pageWidth, pageHeight, rect, pixelW, pixelH) {
  const rectLongEdge = Math.max(rect.w, rect.h);
  let scale = TARGET_LONG_EDGE / rectLongEdge;
  if (pixelW && pixelH) {
    scale = Math.min(scale, Math.min(pixelW / rect.w, pixelH / rect.h));
  }
  scale = Math.min(scale, MAX_SCALE);
  const maxScaleForCanvas = Math.sqrt(MAX_CANVAS_PIXELS / (pageWidth * pageHeight));
  scale = Math.min(scale, maxScaleForCanvas);
  return Math.max(scale, MIN_SCALE);
}

export async function renderPageToCanvas(page, scale) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

export async function embedCanvasCentered(
  outDoc,
  canvas,
  widthPt,
  heightPt,
  maxWidthPt,
  maxHeightPt,
  align = 'center',
) {
  const blob = await canvasToBlob(canvas);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image = await outDoc.embedJpg(bytes);
  const page = outDoc.addPage([maxWidthPt, maxHeightPt]);
  const fit = Math.min(maxWidthPt / widthPt, maxHeightPt / heightPt);
  const drawWidth = widthPt * fit;
  const drawHeight = heightPt * fit;
  let x = (maxWidthPt - drawWidth) / 2;
  if (align === 'left') x = 0;
  if (align === 'right') x = maxWidthPt - drawWidth;
  page.drawImage(image, {
    x,
    y: (maxHeightPt - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

export async function processSplitScan(pdfBytes, onProgress = () => {}) {
  const doc = await loadPdfDoc(pdfBytes.slice());
  const pageEntries = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    onProgress({ phase: 'validate', current: pageNum, total: doc.numPages });
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageEntries.push({
      page,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    });
  }

  const pageSizes = pageEntries.map(({ pageWidth, pageHeight }) => ({
    width: pageWidth,
    height: pageHeight,
  }));
  const singlePageBaseline = computeSinglePageBaseline(pageSizes);
  const outputs = pageEntries.map((meta) => {
    const shouldSplit = shouldSplitPage({
      width: meta.pageWidth,
      height: meta.pageHeight,
    }, singlePageBaseline);
    return {
      meta,
      shouldSplit,
      widthPt: shouldSplit ? meta.pageWidth / 2 : meta.pageWidth,
      heightPt: meta.pageHeight,
    };
  });

  let maxWidthPt = 1;
  let maxHeightPt = 1;
  for (const output of outputs) {
    maxWidthPt = Math.max(maxWidthPt, output.widthPt);
    maxHeightPt = Math.max(maxHeightPt, output.heightPt);
  }

  const outDoc = await PDFDocument.create();
  let splitCount = 0;

  for (let i = 0; i < outputs.length; i++) {
    const output = outputs[i];
    onProgress({ phase: 'process', current: i + 1, total: outputs.length });
    const { page, pageWidth, pageHeight } = output.meta;
    const scale = computeRenderScale(
      pageWidth,
      pageHeight,
      { x: 0, y: 0, w: pageWidth, h: pageHeight },
    );
    const canvas = await renderPageToCanvas(page, scale);

    if (output.shouldSplit) {
      splitCount++;
      const [left, right] = splitCanvas(canvas);
      releaseCanvas(canvas);
      // A spread's left half becomes a left-hand page, so its spine is on the right edge.
      await embedCanvasCentered(
        outDoc,
        left,
        output.widthPt,
        output.heightPt,
        maxWidthPt,
        maxHeightPt,
        'right',
      );
      releaseCanvas(left);
      await embedCanvasCentered(
        outDoc,
        right,
        output.widthPt,
        output.heightPt,
        maxWidthPt,
        maxHeightPt,
        'left',
      );
      releaseCanvas(right);
    } else {
      await embedCanvasCentered(outDoc, canvas, output.widthPt, output.heightPt, maxWidthPt, maxHeightPt);
      releaseCanvas(canvas);
    }
  }

  onProgress({ phase: 'build' });
  const pdfData = await outDoc.save();
  const blob = new Blob([pdfData], { type: 'application/pdf' });

  return {
    blob,
    info: {
      originalPages: doc.numPages,
      splitCount,
      resultPages: doc.numPages + splitCount,
      pageSize: { width: maxWidthPt, height: maxHeightPt },
    },
  };
}
