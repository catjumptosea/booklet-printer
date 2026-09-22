// Shared PDF page geometry. Preview and export must derive orientation,
// display size and crop coordinates from the same source of truth.
export function normalizeQuarterTurn(angle) {
  const numeric = Number(angle);
  if (!Number.isFinite(numeric)) return 0;
  return ((Math.round(numeric / 90) * 90) % 360 + 360) % 360;
}

export function getPageRotation(page) {
  return normalizeQuarterTurn(page?.getRotation?.().angle);
}

export function getRotatedSize(width, height, angle) {
  const normalized = normalizeQuarterTurn(angle);
  return normalized % 180 === 0
    ? { width, height }
    : { width: height, height: width };
}

export function normalizeCrop(crop = null) {
  const left = Math.max(0, Math.min(1, crop?.left ?? 0));
  const top = Math.max(0, Math.min(1, crop?.top ?? 0));
  const width = Math.max(0.001, Math.min(1 - left, crop?.width ?? 1));
  const height = Math.max(0.001, Math.min(1 - top, crop?.height ?? 1));
  return { left, top, width, height };
}

// The UI crop is expressed in display coordinates after /Rotate has been
// applied. Get the rotated display box, then invert pdf.js's viewport
// transform so pdf-lib receives the corresponding raw MediaBox rectangle.
export function getPageCropBox(rawWidth, rawHeight, angle, crop = null) {
  const normalizedCrop = normalizeCrop(crop);
  const { left: u0, top: v0, width: cropWidth, height: cropHeight } = normalizedCrop;
  const u1 = u0 + cropWidth;
  const v1 = v0 + cropHeight;
  const metaAngle = normalizeQuarterTurn(angle);
  const { width: displayWidth, height: displayHeight } = getRotatedSize(rawWidth, rawHeight, metaAngle);

  // pdf.js applies this top-left-origin matrix to raw page coordinates. Invert
  // each display-space corner, then take the raw-axis bounding box.
  const matrix = {
    0: [1, 0, 0, -1, 0, rawHeight],
    90: [0, 1, 1, 0, 0, 0],
    180: [-1, 0, 0, 1, rawWidth, 0],
    270: [0, -1, -1, 0, rawHeight, rawWidth],
  }[metaAngle] || [1, 0, 0, -1, 0, rawHeight];
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  const toRaw = (x, y) => {
    const displayX = x * displayWidth;
    const displayY = y * displayHeight;
    const px = displayX - e;
    const py = displayY - f;
    return {
      x: (d * px - c * py) / determinant,
      y: (-b * px + a * py) / determinant,
    };
  };

  const corners = [
    toRaw(u0, v0),
    toRaw(u1, v0),
    toRaw(u0, v1),
    toRaw(u1, v1),
  ];
  const xs = corners.map((point) => point.x);
  const ys = corners.map((point) => point.y);
  const rawX0 = Math.min(...xs);
  const rawX1 = Math.max(...xs);
  const rawY0 = Math.min(...ys);
  const rawY1 = Math.max(...ys);

  const hasCrop = u0 > 0 || v0 > 0 || cropWidth < 1 || cropHeight < 1;
  return {
    left: rawX0,
    bottom: rawY0,
    right: rawX1,
    top: rawY1,
    width: rawX1 - rawX0,
    height: rawY1 - rawY0,
    hasCrop,
  };
}
