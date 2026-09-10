// 骑马订标准拼版：总页数 N' 为 4 的倍数，第 i 张纸（1-based）
//   正面：左 = N' - 2i + 2，右 = 2i - 1
//   反面：左 = 2i，右 = N' - 2i + 1
// 空白页数量由 4 的倍数规则自动决定；每个空白页可指定成册后的页码。
export const MIN_SPINE_GAP_MM = 0;
export const MAX_SPINE_GAP_MM = 280;

export const PAPER_SIZES = {
  a4: {
    id: 'a4',
    label: 'A4',
    sizeText: '297 × 210 mm',
    sheetWidthMm: 297,
    sheetHeightMm: 210,
  },
  long: {
    id: 'long',
    label: '长条纸',
    sizeText: '210 × 420 mm',
    sheetWidthMm: 420,
    sheetHeightMm: 210,
  },
};

export const DEFAULT_PAPER_SIZE = 'a4';

export const BOOKLET_FORMATS = {
  a5: {
    id: 'a5',
    label: 'A5 小册子',
    pagesPerSheet: 4,
  },
  a6: {
    id: 'a6',
    label: 'A6 小册子',
    pagesPerSheet: 8,
  },
};

export const DEFAULT_BOOKLET_FORMAT = 'a5';

export const PAGE_CONTENT_MODES = {
  single: 'single',
  horizontal: 'horizontal',
};

export const DEFAULT_PAGE_CONTENT_MODE = PAGE_CONTENT_MODES.single;

export function normalizePageContentMode(value) {
  return Object.values(PAGE_CONTENT_MODES).includes(value)
    ? value
    : DEFAULT_PAGE_CONTENT_MODE;
}

export function normalizePaperSize(value) {
  return PAPER_SIZES[value] ? value : DEFAULT_PAPER_SIZE;
}

export function normalizeBookletFormat(value) {
  return BOOKLET_FORMATS[value] ? value : DEFAULT_BOOKLET_FORMAT;
}

// A6 模式下，A4 纸张保持横向使用：297 × 210 mm，每面排 2×2。
export function getSheetLayout(paperSize, bookletFormat = DEFAULT_BOOKLET_FORMAT) {
  const paper = PAPER_SIZES[paperSize] || PAPER_SIZES.a4;
  const isA6 = normalizeBookletFormat(bookletFormat) === 'a6';
  const sheetWidthMm = paper.sheetWidthMm;
  const sheetHeightMm = paper.sheetHeightMm;
  return {
    paper,
    sheetWidthMm,
    sheetHeightMm,
    pageWidthMm: sheetWidthMm / 2,
    pageHeightMm: isA6 ? sheetHeightMm / 2 : sheetHeightMm,
  };
}

export function normalizeSpineGap(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_SPINE_GAP_MM;
  return Math.min(MAX_SPINE_GAP_MM, Math.max(MIN_SPINE_GAP_MM, Math.round(parsed)));
}

export function buildBookletPlan(
  sourcePageCount,
  blankPositionsOverride,
  bookletFormat = DEFAULT_BOOKLET_FORMAT,
  pageContentMode = DEFAULT_PAGE_CONTENT_MODE,
) {
  const format = normalizeBookletFormat(bookletFormat);
  const contentMode = normalizePageContentMode(pageContentMode);
  const pagesPerSheet = BOOKLET_FORMATS[format].pagesPerSheet;
  const contentPages = buildContentPages(sourcePageCount, contentMode);
  const contentPageCount = contentPages.length;
  const blankCount = (pagesPerSheet - (contentPageCount % pagesPerSheet)) % pagesPerSheet;
  const total = contentPageCount + blankCount;
  const sheets = total / pagesPerSheet;
  const blankPositions = normalizeBlankPositions(contentPageCount, blankCount, blankPositionsOverride);
  const blankPages = new Set(blankPositions);
  const pageSlots = [];
  let contentPageIndex = 0;

  for (let bookletPage = 1; bookletPage <= total; bookletPage += 1) {
    if (blankPages.has(bookletPage)) {
      pageSlots.push({ kind: 'blank', sourcePage: null, bookletPage });
    } else {
      pageSlots.push({ kind: 'page', bookletPage, ...contentPages[contentPageIndex] });
      contentPageIndex += 1;
    }
  }

  const plan = [];

  if (format === 'a6') {
    for (let i = 1; i <= sheets; i += 1) {
      plan.push({
        index: i,
        front: {
          topLeft: pageSlots[total - 4 * i + 2 - 1],
          topRight: pageSlots[4 * i - 1 - 1],
          bottomLeft: pageSlots[total - 4 * i + 4 - 1],
          bottomRight: pageSlots[4 * i - 3 - 1],
        },
        back: {
          topLeft: pageSlots[4 * i - 1],
          topRight: pageSlots[total - 4 * i + 1 - 1],
          bottomLeft: pageSlots[4 * i - 3],
          bottomRight: pageSlots[total - 4 * i + 3 - 1],
        },
      });
    }
  } else {
    for (let i = 1; i <= sheets; i += 1) {
      plan.push({
        index: i,
        front: {
          left: pageSlots[total - 2 * i + 2 - 1],
          right: pageSlots[2 * i - 1 - 1],
        },
        back: {
          left: pageSlots[2 * i - 1],
          right: pageSlots[total - 2 * i + 1 - 1],
        },
      });
    }
  }

  return {
    originalPageCount: sourcePageCount,
    sourcePageCount,
    contentPageCount,
    blankCount,
    blankPositions,
    total,
    sheets,
    format,
    pagesPerSheet,
    pageContentMode: contentMode,
    plan,
    pageSlots,
  };
}

function buildContentPages(sourcePageCount, pageContentMode) {
  const contentMode = normalizePageContentMode(pageContentMode);
  const pages = [];

  if (contentMode === PAGE_CONTENT_MODES.horizontal && sourcePageCount > 0) {
    const leftCrop = { left: 0, top: 0, width: 0.5, height: 1 };
    const rightCrop = { left: 0.5, top: 0, width: 0.5, height: 1 };

    pages.push({ sourcePage: 1, crop: rightCrop });
    for (let sourcePage = 2; sourcePage <= sourcePageCount; sourcePage += 1) {
      pages.push(
        { sourcePage, crop: leftCrop },
        { sourcePage, crop: rightCrop },
      );
    }
    pages.push({ sourcePage: 1, crop: leftCrop });
    return pages;
  }

  for (let sourcePage = 1; sourcePage <= sourcePageCount; sourcePage += 1) {
    pages.push({ sourcePage, crop: null });
  }

  return pages;
}

export function normalizeBlankPositions(originalPageCount, blankCount, blankPositionsOverride) {
  const total = originalPageCount + blankCount;
  const defaultPositions = Array.from(
    { length: blankCount },
    (_, index) => total - blankCount + index + 1,
  );

  if (!Array.isArray(blankPositionsOverride) || blankPositionsOverride.length !== blankCount) {
    return defaultPositions;
  }

  const positions = blankPositionsOverride.map((position) => Number(position));
  const isValid = positions.every((position) => (
    Number.isInteger(position)
    && position >= 1
    && position <= total
  )) && new Set(positions).size === blankCount;

  return isValid ? positions : defaultPositions;
}

// 翻页视图：按阅读顺序的摊开页（spread）。
// spread s（0-based，共 total/2 + 1 个）：
//   s = 0        → 右 = 第 1 页（封面），左为空
//   0 < s < N/2  → 左 = 第 2s 页，右 = 第 2s + 1 页
//   s = N/2      → 左 = 第 N 页（封底），右为空
export function buildReadingSpreads(plan) {
  const { total, pageSlots } = plan;
  const spreads = [];
  const half = total / 2;

  for (let s = 0; s <= half; s += 1) {
    const left = s === 0 ? { kind: 'outside' } : pageSlots[2 * s - 1];
    const right = s === half ? { kind: 'outside' } : pageSlots[2 * s];
    spreads.push({
      index: s,
      left,
      right,
    });
  }

  return spreads;
}
