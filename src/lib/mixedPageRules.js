// Scanned picture books contain either one page image or a two-page spread.
// Page-to-page size variation is expected, so classification must use the
// page's own display aspect ratio instead of a document-relative baseline.
export const SPREAD_ASPECT_RATIO = 1.5;

function isValidPageSize(pageSize) {
  return Number.isFinite(pageSize?.width)
    && Number.isFinite(pageSize?.height)
    && pageSize.width > 0
    && pageSize.height > 0;
}

export function shouldSplitPage(pageSize) {
  if (!isValidPageSize(pageSize)) return false;
  return pageSize.width / pageSize.height >= SPREAD_ASPECT_RATIO;
}
