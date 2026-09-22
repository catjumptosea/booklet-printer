import { degrees } from 'pdf-lib';
import { getPageCropBox } from './pageGeometry.js';

export async function embedWholePage(outDoc, srcPage) {
  try {
    return await outDoc.embedPage(srcPage);
  } catch (error) {
    // Empty scanned pages may not have a Contents stream.
    if (/missing Contents/i.test(String(error?.message || ''))) return null;
    throw error;
  }
}

export async function appendNormalizedPage(outDoc, meta, crop = null, embedded = null) {
  const box = getPageCropBox(meta.rawWidth, meta.rawHeight, meta.rotation, crop);
  const page = outDoc.addPage([box.width, box.height]);
  if (embedded) {
    // drawPage applies its own rotation around the drawing anchor, while
    // page /Rotate is applied around the page origin. Draw the raw crop into
    // the unrotated output box, then set the page rotation once.
    page.drawPage(embedded, {
      x: -box.left,
      y: -box.bottom,
      width: meta.rawWidth,
      height: meta.rawHeight,
    });
  }
  if (meta.rotation !== 0) {
    page.setRotation(degrees(meta.rotation));
  }
}
