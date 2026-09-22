import {
  PDFDocument,
  clip,
  degrees,
  endPath,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  rgb,
} from 'pdf-lib';
import { MAX_SPINE_GAP_MM, PAPER_SIZES } from './booklet';
import {
  getPageCropBox,
  getPageRotation,
  getRotatedSize,
} from './pageGeometry.js';

const MM = 2.834645; // 1 mm = 2.8346 pt
const OUTER_MARGIN = 0;
const V_MARGIN = 0;
const FOLD_MARK_COLOR = rgb(0.72, 0.72, 0.72);
const FOLD_MARK_LENGTH_MM = 6;
const FOLD_MARK_THICKNESS = 0.4;

function getSheetSize(paperSize, bookletFormat = 'a5') {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const isA6 = bookletFormat === 'a6';
  return {
    id: isA6 ? 'a6' : paper.id,
    width: paper.sheetWidthMm * MM,
    height: paper.sheetHeightMm * MM,
  };
}

function slotBox(position, spineGap = 0, sheet, bookletFormat = 'a5') {
  const half = sheet.width / 2;
  const halfHeight = sheet.height / 2;
  const clampedSpineGap = Math.min(MAX_SPINE_GAP_MM, Math.max(0, Number(spineGap) || 0));
  const spineGapPt = clampedSpineGap * MM;
  const gutterHalf = spineGapPt / 2;

  if (bookletFormat === 'a6') {
    const outerMargin = 0;
    const verticalMargin = 0;
    const isTop = position === 'topLeft' || position === 'topRight';
    const box = {
      y: isTop ? halfHeight + verticalMargin : verticalMargin,
      h: Math.max(0, halfHeight - verticalMargin * 2),
    };
    if (position === 'topLeft' || position === 'bottomLeft') {
      return { ...box, x: outerMargin, w: Math.max(0, half - gutterHalf - outerMargin) };
    }
    return { ...box, x: half + gutterHalf, w: Math.max(0, half - gutterHalf - outerMargin) };
  }

  if (position === 'left') {
    return { x: OUTER_MARGIN, y: V_MARGIN, w: Math.max(0, half - gutterHalf - OUTER_MARGIN), h: sheet.height - V_MARGIN * 2 };
  }
  return { x: half + gutterHalf, y: V_MARGIN, w: Math.max(0, half - gutterHalf - OUTER_MARGIN), h: sheet.height - V_MARGIN * 2 };
}

function drawFoldMarks(page, sheet) {
  const foldX = sheet.width / 2;
  const markLength = FOLD_MARK_LENGTH_MM * MM;

  page.drawLine({
    start: { x: foldX, y: sheet.height },
    end: { x: foldX, y: sheet.height - markLength },
    thickness: FOLD_MARK_THICKNESS,
    color: FOLD_MARK_COLOR,
  });
  page.drawLine({
    start: { x: foldX, y: 0 },
    end: { x: foldX, y: markLength },
    thickness: FOLD_MARK_THICKNESS,
    color: FOLD_MARK_COLOR,
  });
}

function drawCutMarks(page, sheet) {
  const cutY = sheet.height / 2;

  page.drawLine({
    start: { x: 0, y: cutY },
    end: { x: sheet.width, y: cutY },
    thickness: FOLD_MARK_THICKNESS,
    color: FOLD_MARK_COLOR,
    dashArray: [2.5 * MM, 2.5 * MM],
  });
}

function getCreepShiftPt(sheetIndex, totalSheets, creepMm) {
  const parsed = Number(creepMm);
  if (totalSheets <= 1 || !Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed * MM * (totalSheets - sheetIndex) / (totalSheets - 1);
}

async function embedPageForSlot(outDoc, srcPage, cropBox) {
  try {
    return await outDoc.embedPage(srcPage, cropBox);
  } catch (error) {
    // Some scanned PDFs contain empty pages without a Contents stream.
    // Treat those pages as blank instead of failing the whole export.
    if (/missing Contents/i.test(String(error?.message || ''))) return null;
    throw error;
  }
}

async function placeSlot(page, outDoc, srcDoc, slot, position, spineGap, sheet, creepShiftPt = 0, bookletFormat = 'a5') {
  if (slot.kind !== 'page') return;
  const srcPage = srcDoc.getPage(slot.sourcePage - 1);
  const { width: rawW, height: rawH } = srcPage.getSize();
  const crop = slot.crop;
  const metaAngle = getPageRotation(srcPage);
  const sourceBox = getPageCropBox(rawW, rawH, metaAngle, crop);
  const embedded = await embedPageForSlot(
    outDoc,
    srcPage,
    sourceBox.hasCrop ? {
      left: sourceBox.left,
      bottom: sourceBox.bottom,
      right: sourceBox.right,
      top: sourceBox.top,
    } : undefined,
  );
  const sourceW = sourceBox.width;
  const sourceH = sourceBox.height;

  // 与两个预览保持一致：pdf.js 按 /Rotate 顺时针显示；A6 的横向槽位遇到
  // 竖向源页时，预览会再顺时针转 1/4 圈。A5 槽位本身就是竖向，不再补转，
  // 否则横向源页导出后会被转 90°，与预览不符。
  const { width: displayW, height: displayH } = getRotatedSize(sourceW, sourceH, metaAngle);
  const needsQuarterTurn = bookletFormat === 'a6' && displayW < displayH;
  // pdf-lib 的 rotate 是逆时针，总角度取反才能得到预览里的顺时针效果。
  const targetAngle = (360 - ((metaAngle + (needsQuarterTurn ? 90 : 0)) % 360)) % 360;
  const swapped = targetAngle === 90 || targetAngle === 270;
  const fitW = swapped ? sourceH : sourceW;
  const fitH = swapped ? sourceW : sourceH;

  const box = slotBox(position, spineGap, sheet, bookletFormat);
  // 等比缩放并居中，与预览的 min(...) 拟合方式一致，不再拉伸变形。
  const scale = Math.min(box.w / fitW, box.h / fitH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  // Equal-aspect fitting can leave a narrow side band. Anchor it to the fold
  // so spineGap=0 produces two touching page areas without a center gap.
  const drawnWidth = targetAngle === 90 || targetAngle === 270 ? drawH : drawW;
  const isLeft = position === 'left'
    || position === 'topLeft'
    || position === 'bottomLeft';
  const baseCx = isLeft
    ? box.x + box.w - drawnWidth / 2
    : box.x + drawnWidth / 2;
  // 爬移补偿：内容向折叠线方向预偏移，折叠后折线几何将内容推回正确位置。
  const cx = isLeft ? baseCx + creepShiftPt : baseCx - creepShiftPt;
  const cy = box.y + box.h / 2;

  // pdf-lib rotates the embedded page counter-clockwise about the anchor we
  // pass as (x, y). Derive that anchor from the desired centre so the slot
  // position and the content rotation stay independent of each other.
  const rad = (targetAngle * Math.PI) / 180;
  const cos = Math.round(Math.cos(rad));
  const sin = Math.round(Math.sin(rad));
  const offsetX = (drawW / 2) * cos - (drawH / 2) * sin;
  const offsetY = (drawW / 2) * sin + (drawH / 2) * cos;
  const x = cx - offsetX;
  const y = cy - offsetY;

  if (embedded) {
    if (sourceBox.hasCrop) {
      page.pushOperators(
        pushGraphicsState(),
        rectangle(box.x, box.y, box.w, box.h),
        clip(),
        endPath(),
      );
    }
    page.drawPage(embedded, { x, y, width: drawW, height: drawH, rotate: degrees(targetAngle) });
    if (sourceBox.hasCrop) {
      page.pushOperators(popGraphicsState());
    }
  }
}

async function buildFacesPdf(
  pdfBytes,
  plan,
  faces,
  spineGap,
  {
    showFoldMarks = false,
    creepMm = 0,
    paperSize = 'a4',
    bookletFormat: requestedBookletFormat = 'a5',
  } = {},
) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const outDoc = await PDFDocument.create();
  const bookletFormat = requestedBookletFormat === 'a6' || plan.format === 'a6'
    ? 'a6'
    : 'a5';
  const sheet = getSheetSize(paperSize, bookletFormat);
  const positions = bookletFormat === 'a6'
    ? ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
    : ['left', 'right'];

  for (const face of faces) {
    const page = outDoc.addPage([sheet.width, sheet.height]);
    const shift = getCreepShiftPt(face.sheetIndex, plan.sheets, creepMm);
    for (const position of positions) {
      await placeSlot(page, outDoc, srcDoc, face[position], position, spineGap, sheet, shift, bookletFormat);
    }
    if (showFoldMarks) {
      drawFoldMarks(page, sheet);
      if (bookletFormat === 'a6') drawCutMarks(page, sheet);
    }
  }

  return outDoc.save();
}

export function collectFaces(plan, mode) {
  const faces = [];
  for (const sheet of plan.plan) {
    if (mode !== 'back') faces.push({ ...sheet.front, sheetIndex: sheet.index });
    if (mode !== 'front') faces.push({ ...sheet.back, sheetIndex: sheet.index });
  }
  return faces;
}

export async function buildExportPdf(pdfBytes, plan, mode, spineGap = 0, options = {}) {
  return buildFacesPdf(pdfBytes, plan, collectFaces(plan, mode), spineGap, options);
}

export function baseName(fileName) {
  return fileName.replace(/\.pdf$/i, '');
}
