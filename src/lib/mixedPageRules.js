const HIGH_CONFIDENCE_SPREAD_RATIO = 1.5;
const SINGLE_PAGE_MAX_RATIO = 1.2;
const RELATIVE_SPREAD_MIN_WIDTH_FACTOR = 1.7;
const RELATIVE_SPREAD_MAX_WIDTH_FACTOR = 2.2;
const RELATIVE_HEIGHT_TOLERANCE = 0.1;

function isValidPageSize(pageSize) {
  return Number.isFinite(pageSize?.width)
    && Number.isFinite(pageSize?.height)
    && pageSize.width > 0
    && pageSize.height > 0;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export function computeSinglePageBaseline(pageSizes) {
  const singlePages = pageSizes.filter((pageSize) => (
    isValidPageSize(pageSize)
    && pageSize.width / pageSize.height < SINGLE_PAGE_MAX_RATIO
  ));

  if (singlePages.length === 0) return null;

  return {
    width: median(singlePages.map((pageSize) => pageSize.width)),
    height: median(singlePages.map((pageSize) => pageSize.height)),
  };
}

export function shouldSplitPage(pageSize, singlePageBaseline = null) {
  if (!isValidPageSize(pageSize)) return false;

  const aspectRatio = pageSize.width / pageSize.height;
  if (aspectRatio >= HIGH_CONFIDENCE_SPREAD_RATIO) return true;
  if (aspectRatio < SINGLE_PAGE_MAX_RATIO || !singlePageBaseline) return false;
  if (!isValidPageSize(singlePageBaseline)) return false;

  const widthFactor = pageSize.width / singlePageBaseline.width;
  const heightDelta = Math.abs(pageSize.height - singlePageBaseline.height)
    / singlePageBaseline.height;

  return widthFactor >= RELATIVE_SPREAD_MIN_WIDTH_FACTOR
    && widthFactor <= RELATIVE_SPREAD_MAX_WIDTH_FACTOR
    && heightDelta <= RELATIVE_HEIGHT_TOLERANCE;
}
