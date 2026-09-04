import { PDFDocument, degrees } from 'pdf-lib';

// 打印面为 A4 横向（841.89 × 595.28 pt）：左右两个 A5 竖版页，
// 折叠线在垂直中线；双面打印使用“短边翻转”。
const SHEET = { width: 841.89, height: 595.28 };
const MM = 2.834645; // 1 mm = 2.8346 pt
const OUTER_MARGIN = 4 * MM;
const GUTTER = 6 * MM; // 装订侧总留白，中线两侧各 3mm
const V_MARGIN = 4 * MM;

function slotBox(side) {
  const half = SHEET.width / 2;
  const gutterHalf = GUTTER / 2;
  if (side === 'left') {
    return { x: OUTER_MARGIN, y: V_MARGIN, w: half - gutterHalf - OUTER_MARGIN, h: SHEET.height - V_MARGIN * 2 };
  }
  return { x: half + gutterHalf, y: V_MARGIN, w: half - gutterHalf - OUTER_MARGIN, h: SHEET.height - V_MARGIN * 2 };
}

async function placeSlot(page, outDoc, srcDoc, slot, side) {
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

  const box = slotBox(side);
  const scale = Math.min(box.w / vw, box.h / vh);
  const drawW = rawW * scale;
  const drawH = rawH * scale;
  const cx = box.x + box.w / 2;
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

async function buildFacesPdf(pdfBytes, plan, faces) {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const outDoc = await PDFDocument.create();

  for (const face of faces) {
    const page = outDoc.addPage([SHEET.width, SHEET.height]);
    await placeSlot(page, outDoc, srcDoc, face.left, 'left');
    await placeSlot(page, outDoc, srcDoc, face.right, 'right');
  }

  return outDoc.save();
}

export function collectFaces(plan, mode) {
  const faces = [];
  for (const sheet of plan.plan) {
    if (mode !== 'back') faces.push(sheet.front);
    if (mode !== 'front') faces.push(sheet.back);
  }
  return faces;
}

export async function buildExportPdf(pdfBytes, plan, mode) {
  return buildFacesPdf(pdfBytes, plan, collectFaces(plan, mode));
}

export function baseName(fileName) {
  return fileName.replace(/\.pdf$/i, '');
}
