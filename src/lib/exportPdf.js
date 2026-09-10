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

async function placeSlot(page, outDoc, srcDoc, slot, position, spineGap, sheet, creepShiftPt = 0, bookletFormat = 'a5') {
  if (slot.kind !== 'page') return;
  const srcPage = srcDoc.getPage(slot.sourcePage - 1);
  const { width: rawW, height: rawH } = srcPage.getSize();
  const crop = slot.crop;
  const cropLeft = Math.max(0, Math.min(1, crop?.left ?? 0));
  const cropTop = Math.max(0, Math.min(1, crop?.top ?? 0));
  const cropWidth = Math.max(0.001, Math.min(1 - cropLeft, crop?.width ?? 1));
  const cropHeight = Math.max(0.001, Math.min(1 - cropTop, crop?.height ?? 1));
  const sourceW = rawW * cropWidth;
  const sourceH = rawH * cropHeight;
  const embedded = await outDoc.embedPage(srcPage, crop ? {
    left: rawW * cropLeft,
    bottom: rawH * (1 - cropTop - cropHeight),
    right: rawW * (cropLeft + cropWidth),
    top: rawH * (1 - cropTop),
  } : undefined);
  const metaAngle = ((srcPage.getRotation().angle % 360) + 360) % 360;
  // 元数据旋转的页面绘制时补偿回正；A6 竖版源页顺时针旋转到横版槽位。
  const angle = metaAngle !== 0
    ? metaAngle
    : bookletFormat === 'a6'
      ? (rawW > rawH ? 0 : 90)
      : (rawW > rawH ? 90 : 0);
  const metadataSwapped = metaAngle === 90 || metaAngle === 270;
  const metadataWidth = metadataSwapped ? sourceH : sourceW;
  const metadataHeight = metadataSwapped ? sourceW : sourceH;
  const needsQuarterTurn = bookletFormat === 'a6'
    ? metadataWidth < metadataHeight
    : metadataWidth > metadataHeight;
  const targetAngle = (
    metaAngle
    + (needsQuarterTurn ? 90 : 0)
    + (bookletFormat === 'a6' && !crop ? 180 : 0)
  ) % 360;
  const swapped = targetAngle === 90 || targetAngle === 270;
  const vw = swapped ? sourceH : sourceW;
  const vh = swapped ? sourceW : sourceH;

  const box = slotBox(position, spineGap, sheet, bookletFormat);
  const scale = Math.min(box.w / vw, box.h / vh);
  const normalizedSpineGap = Math.min(MAX_SPINE_GAP_MM, Math.max(0, Number(spineGap) || 0));
  const fitToBox = sheet.id === 'long' || normalizedSpineGap > 0 || Boolean(crop);
  const drawW = fitToBox
    ? sourceW * scale
    : swapped ? box.h : box.w;
  const drawH = fitToBox
    ? sourceH * scale
    : swapped ? box.w : box.h;
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

  let x;
  let y;
  if (targetAngle === 0) {
    x = cx - drawW / 2;
    y = cy - drawH / 2;
  } else if (targetAngle === 90) {
    x = cx + drawH / 2;
    y = cy - drawW / 2;
  } else if (targetAngle === 180) {
    x = cx + drawW / 2;
    y = cy + drawH / 2;
  } else {
    x = cx - drawH / 2;
    y = cy + drawW / 2;
  }

  if (crop) {
    page.pushOperators(
      pushGraphicsState(),
      rectangle(box.x, box.y, box.w, box.h),
      clip(),
      endPath(),
    );
  }
  page.drawPage(embedded, { x, y, width: drawW, height: drawH, rotate: degrees(targetAngle) });
  if (crop) {
    page.pushOperators(popGraphicsState());
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
