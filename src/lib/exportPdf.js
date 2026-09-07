import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { MAX_SPINE_GAP_MM, PAPER_SIZES } from './booklet';

const MM = 2.834645; // 1 mm = 2.8346 pt
const OUTER_MARGIN = 4 * MM;
const V_MARGIN = 4 * MM;
const FOLD_MARK_COLOR = rgb(0.72, 0.72, 0.72);
const FOLD_MARK_LENGTH_MM = 6;
const FOLD_MARK_THICKNESS = 0.4;

function getSheetSize(paperSize) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  return {
    id: paper.id,
    width: paper.sheetWidthMm * MM,
    height: paper.sheetHeightMm * MM,
  };
}

function slotBox(side, spineGap = 0, sheet) {
  const half = sheet.width / 2;
  const clampedSpineGap = Math.min(MAX_SPINE_GAP_MM, Math.max(0, Number(spineGap) || 0));
  const spineGapPt = clampedSpineGap * MM;
  const gutterHalf = spineGapPt / 2;
  if (side === 'left') {
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

function getCreepShiftPt(sheetIndex, totalSheets, creepMm) {
  const parsed = Number(creepMm);
  if (totalSheets <= 1 || !Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed * MM * (totalSheets - sheetIndex) / (totalSheets - 1);
}

async function placeSlot(page, outDoc, srcDoc, slot, side, spineGap, sheet, creepShiftPt = 0) {
  if (slot.kind !== 'page') return;
  const srcPage = srcDoc.getPage(slot.sourcePage - 1);
  const embedded = await outDoc.embedPage(srcPage);
  const { width: rawW, height: rawH } = srcPage.getSize();
  const metaAngle = ((srcPage.getRotation().angle % 360) + 360) % 360;
  // 元数据旋转的页面绘制时补偿回正；横向页面旋转 90° 适配竖版半区。
  const angle = metaAngle !== 0 ? metaAngle : rawW > rawH ? 90 : 0;
  const swapped = angle === 90 || angle === 270;
  const vw = swapped ? rawH : rawW;
  const vh = swapped ? rawW : rawH;

  const box = slotBox(side, spineGap, sheet);
  const scale = Math.min(box.w / vw, box.h / vh);
  const drawW = rawW * scale;
  const drawH = rawH * scale;
  // Equal-aspect fitting can leave a narrow side band. Anchor it to the fold
  // so spineGap=0 produces two touching page areas without a center gap.
  const drawnWidth = angle === 90 || angle === 270 ? drawH : drawW;
  const baseCx = side === 'left'
    ? box.x + box.w - drawnWidth / 2
    : box.x + drawnWidth / 2;
  // 爬移补偿：内容向折叠线方向预偏移，折叠后折线几何将内容推回正确位置。
  const cx = side === 'left' ? baseCx + creepShiftPt : baseCx - creepShiftPt;
  const cy = box.y + box.h / 2;

  let x;
  let y;
  if (angle === 0) {
    x = cx - drawW / 2;
    y = cy - drawH / 2;
  } else if (angle === 90) {
    x = cx + drawH / 2;
    y = cy - drawW / 2;
  } else if (angle === 180) {
    x = cx + drawW / 2;
    y = cy + drawH / 2;
  } else {
    x = cx - drawH / 2;
    y = cy + drawW / 2;
  }

  page.drawPage(embedded, { x, y, width: drawW, height: drawH, rotate: degrees(angle) });
}

async function buildFacesPdf(pdfBytes, plan, faces, spineGap, { showFoldMarks = false, creepMm = 0, paperSize = 'a4' } = {}) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const outDoc = await PDFDocument.create();
  const sheet = getSheetSize(paperSize);

  for (const face of faces) {
    const page = outDoc.addPage([sheet.width, sheet.height]);
    const shift = getCreepShiftPt(face.sheetIndex, plan.sheets, creepMm);
    await placeSlot(page, outDoc, srcDoc, face.left, 'left', spineGap, sheet, shift);
    await placeSlot(page, outDoc, srcDoc, face.right, 'right', spineGap, sheet, shift);
    if (showFoldMarks) drawFoldMarks(page, sheet);
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
