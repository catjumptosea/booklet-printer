import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { loadPdfDoc } from './pdfjs';

const MIN_ASPECT_RATIO = 1.5;
const TARGET_LONG_EDGE = 2400;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const MAX_CANVAS_PIXELS = 16 * 1024 * 1024;
const JPEG_QUALITY = 0.92;

const IMAGE_OPS = new Set([
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintInlineImageXObject,
  pdfjsLib.OPS.paintImageXObjectRepeat,
  pdfjsLib.OPS.paintInlineImageXObjectGroup,
  pdfjsLib.OPS.paintImageMaskXObject,
  pdfjsLib.OPS.paintImageMaskXObjectGroup,
  pdfjsLib.OPS.paintImageMaskXObjectRepeat,
  pdfjsLib.OPS.paintSolidColorImageMask,
]);

const CONTENT_OPS = new Set([
  pdfjsLib.OPS.showText,
  pdfjsLib.OPS.showSpacedText,
  pdfjsLib.OPS.nextLineShowText,
  pdfjsLib.OPS.nextLineSetSpacingShowText,
  pdfjsLib.OPS.stroke,
  pdfjsLib.OPS.closeStroke,
  pdfjsLib.OPS.fill,
  pdfjsLib.OPS.eoFill,
  pdfjsLib.OPS.fillStroke,
  pdfjsLib.OPS.eoFillStroke,
  pdfjsLib.OPS.closeFillStroke,
  pdfjsLib.OPS.closeEOFillStroke,
  pdfjsLib.OPS.shadingFill,
]);

export function canvasToBlob(canvas, type = 'image/jpeg', quality = JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas 转 Blob 失败'))),
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

function toPositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function transformPoint(matrix, x, y) {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}

function multiplyMatrices(left, right) {
  const [a, b, c, d, e, f] = left;
  const [g, h, i, j, k, l] = right;
  return [
    a * g + c * h,
    b * g + d * h,
    a * i + c * j,
    b * i + d * j,
    a * k + c * l + e,
    b * k + d * l + f,
  ];
}

function unitSquareAabb(matrix) {
  const corners = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => (
    transformPoint(matrix, x, y)
  ));
  const xs = corners.map((point) => point[0]);
  const ys = corners.map((point) => point[1]);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function collectImageEntries(fn, args, ctm) {
  if (fn === pdfjsLib.OPS.paintImageXObject) {
    return [{
      rect: unitSquareAabb(ctm),
      pixelW: toPositiveNumber(args[1]),
      pixelH: toPositiveNumber(args[2]),
    }];
  }
  if (fn === pdfjsLib.OPS.paintInlineImageXObject) {
    const img = args[0] || {};
    return [{
      rect: unitSquareAabb(ctm),
      pixelW: toPositiveNumber(img.width),
      pixelH: toPositiveNumber(img.height),
    }];
  }
  if (fn === pdfjsLib.OPS.paintImageXObjectRepeat) {
    const [, scaleX, scaleY, positions] = args;
    const entries = [];
    for (let i = 0; i < positions.length; i += 2) {
      entries.push({
        rect: unitSquareAabb(multiplyMatrices(ctm, [scaleX, 0, 0, scaleY, positions[i], positions[i + 1]])),
      });
    }
    return entries;
  }
  if (fn === pdfjsLib.OPS.paintInlineImageXObjectGroup) {
    const img = args[0] || {};
    const map = args[1];
    if (!Array.isArray(map) || map.length === 0) {
      return [{
        rect: unitSquareAabb(ctm),
        pixelW: toPositiveNumber(img.width),
        pixelH: toPositiveNumber(img.height),
      }];
    }
    return map.map((entry) => ({
      rect: unitSquareAabb(multiplyMatrices(ctm, entry.transform)),
      pixelW: toPositiveNumber(entry.w),
      pixelH: toPositiveNumber(entry.h),
    }));
  }
  if (fn === pdfjsLib.OPS.paintImageMaskXObject) {
    const img = args[0] || {};
    return [{
      rect: unitSquareAabb(ctm),
      pixelW: toPositiveNumber(img.width),
      pixelH: toPositiveNumber(img.height),
    }];
  }
  if (fn === pdfjsLib.OPS.paintImageMaskXObjectGroup) {
    const images = args[0] || [];
    return images.map((img) => ({
      rect: unitSquareAabb(multiplyMatrices(ctm, img.transform || [1, 0, 0, 1, 0, 0])),
      pixelW: toPositiveNumber(img.width),
      pixelH: toPositiveNumber(img.height),
    }));
  }
  if (fn === pdfjsLib.OPS.paintImageMaskXObjectRepeat) {
    const img = args[0] || {};
    const [scaleX, skewX, skewY, scaleY, positions] = args.slice(1);
    const entries = [];
    for (let i = 0; i < (positions?.length || 0); i += 2) {
      entries.push({
        rect: unitSquareAabb(multiplyMatrices(ctm, [scaleX, skewX, skewY, scaleY, positions[i], positions[i + 1]])),
        pixelW: toPositiveNumber(img.width),
        pixelH: toPositiveNumber(img.height),
      });
    }
    return entries;
  }
  if (fn === pdfjsLib.OPS.paintSolidColorImageMask) {
    return [{ rect: unitSquareAabb(ctm) }];
  }
  return [];
}

async function scanPageImages(page, pageNum) {
  const opList = await page.getOperatorList();
  const base = [...page.getViewport({ scale: 1 }).transform];
  let ctm = base;
  const stack = [];
  const entries = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === pdfjsLib.OPS.save) {
      stack.push([...ctm]);
    } else if (fn === pdfjsLib.OPS.restore) {
      const saved = stack.pop();
      if (saved) ctm = saved;
    } else if (fn === pdfjsLib.OPS.transform) {
      ctm = multiplyMatrices(ctm, args);
    } else if (IMAGE_OPS.has(fn)) {
      entries.push(...collectImageEntries(fn, args, ctm));
    } else if (CONTENT_OPS.has(fn)) {
      throw new Error(`第 ${pageNum} 页包含图片以外的元素，请先清理干净`);
    }
  }

  return entries;
}

function clampRectToPage(rect, pageWidth, pageHeight) {
  const x = Math.max(0, Math.min(rect.x, pageWidth));
  const y = Math.max(0, Math.min(rect.y, pageHeight));
  const right = Math.max(0, Math.min(rect.x + rect.w, pageWidth));
  const bottom = Math.max(0, Math.min(rect.y + rect.h, pageHeight));
  return { x, y, w: right - x, h: bottom - y };
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

export function cropCanvas(source, rect, scale) {
  const sx = Math.round(rect.x * scale);
  const sy = Math.round(rect.y * scale);
  const sw = Math.max(1, Math.min(Math.round(rect.w * scale), source.width - sx));
  const sh = Math.max(1, Math.min(Math.round(rect.h * scale), source.height - sy));

  const crop = document.createElement('canvas');
  crop.width = sw;
  crop.height = sh;
  const ctx = crop.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return crop;
}

export function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}

export async function embedCanvasCentered(outDoc, canvas, widthPt, heightPt, maxWidthPt, maxHeightPt) {
  const blob = await canvasToBlob(canvas);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const image = await outDoc.embedJpg(bytes);
  const page = outDoc.addPage([maxWidthPt, maxHeightPt]);
  const fit = Math.min(maxWidthPt / widthPt, maxHeightPt / heightPt);
  const drawWidth = widthPt * fit;
  const drawHeight = heightPt * fit;
  page.drawImage(image, {
    x: (maxWidthPt - drawWidth) / 2,
    y: (maxHeightPt - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
  });
}

export async function processSplitScan(pdfBytes, onProgress = () => {}) {
  const doc = await loadPdfDoc(pdfBytes.slice());

  // Phase 1: validate every page has exactly one image and record its drawn rect.
  const pageMeta = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    onProgress({ phase: 'validate', current: pageNum, total: doc.numPages });
    const page = await doc.getPage(pageNum);
    const entries = await scanPageImages(page, pageNum);
    if (entries.length !== 1) {
      throw new Error(`第 ${pageNum} 页包含 ${entries.length} 个图片，每页必须恰好一个图片`);
    }

    const viewport = page.getViewport({ scale: 1 });
    const pageWidth = viewport.width;
    const pageHeight = viewport.height;
    let rect = clampRectToPage(entries[0].rect, pageWidth, pageHeight);
    if (rect.w < 0.5 || rect.h < 0.5) {
      rect = { x: 0, y: 0, w: pageWidth, h: pageHeight };
    }
    pageMeta.push({
      page,
      pageWidth,
      pageHeight,
      rect,
      pixelW: entries[0].pixelW,
      pixelH: entries[0].pixelH,
    });
  }

  // Phase 2: unify the output page size to the largest image dimensions.
  const outputs = pageMeta.map((meta) => {
    const shouldSplit = meta.rect.w / meta.rect.h >= MIN_ASPECT_RATIO;
    return {
      meta,
      shouldSplit,
      widthPt: shouldSplit ? meta.rect.w / 2 : meta.rect.w,
      heightPt: meta.rect.h,
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
    const { page, pageWidth, pageHeight, rect, pixelW, pixelH } = output.meta;
    const scale = computeRenderScale(pageWidth, pageHeight, rect, pixelW, pixelH);
    const canvas = await renderPageToCanvas(page, scale);
    const cropped = cropCanvas(canvas, rect, scale);
    releaseCanvas(canvas);

    if (output.shouldSplit) {
      splitCount++;
      const [left, right] = splitCanvas(cropped);
      releaseCanvas(cropped);
      await embedCanvasCentered(outDoc, left, output.widthPt, output.heightPt, maxWidthPt, maxHeightPt);
      releaseCanvas(left);
      await embedCanvasCentered(outDoc, right, output.widthPt, output.heightPt, maxWidthPt, maxHeightPt);
      releaseCanvas(right);
    } else {
      await embedCanvasCentered(outDoc, cropped, output.widthPt, output.heightPt, maxWidthPt, maxHeightPt);
      releaseCanvas(cropped);
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
