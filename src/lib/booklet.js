// 骑马订标准拼版：总页数 N' 为 4 的倍数，第 i 张纸（1-based）
//   正面：左 = N' - 2i + 2，右 = 2i - 1
//   反面：左 = 2i，右 = N' - 2i + 1
// 空白页数量由 4 的倍数规则自动决定；每个空白页可指定成册后的页码。
export const MIN_SPINE_GAP_MM = 0;
export const MAX_SPINE_GAP_MM = 280;

export function normalizeSpineGap(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MIN_SPINE_GAP_MM;
  return Math.min(MAX_SPINE_GAP_MM, Math.max(MIN_SPINE_GAP_MM, parsed));
}

export function buildBookletPlan(originalPageCount, blankPositionsOverride) {
  const blankCount = (4 - (originalPageCount % 4)) % 4;
  const total = originalPageCount + blankCount;
  const sheets = total / 4;
  const blankPositions = normalizeBlankPositions(originalPageCount, blankCount, blankPositionsOverride);
  const blankPages = new Set(blankPositions);
  const pageSlots = [];
  let sourcePage = 1;

  for (let bookletPage = 1; bookletPage <= total; bookletPage += 1) {
    if (blankPages.has(bookletPage)) {
      pageSlots.push({ kind: 'blank', sourcePage: null });
    } else {
      pageSlots.push({ kind: 'page', sourcePage });
      sourcePage += 1;
    }
  }

  const plan = [];

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

  return { originalPageCount, blankCount, blankPositions, total, sheets, plan, pageSlots };
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
