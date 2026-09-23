---
branch: main
last_verified_commit: b5007ef
updated_at: 2026-09-23
status: in_progress
---

# TL;DR
v1.6.0 已发布：上传页三条路径（单页/双页/混合文档）全部上线，并修复 A6 导出颠倒、
A6 切换崩溃、书脊间距两视图不一致、双页文档白页等问题。提交已推送 main，
标签 v1.6.0 与 GitHub Release 均已创建，Pages 部署成功。v1.6.1 随后发布：
混合文档按页面尺寸拆分并贴书脊对齐，工作区换文件显示页码进度，说明文案同步更新。
2026-09-21：修复导出朝向与两个预览不一致的问题（横向源页在 A5 下被多转 90°、
A6 竖向源页转到反方向、`/Rotate` 补偿方向相反、非等比拉伸）。改动尚未提交。
2026-09-22：修复册子视图白页：双页/混合文档在册子视图整页空白（纸张视图正常）。
根因是 `renderPageImage` 在 `page.render()` 之前 `ctx.clip()`，pdf.js 对该状态的处理
会让 pdf-lib 重新嵌入的分层 Form XObject 页面整体画不出来；改为渲染后再遮书脊留白。

# 当前目标
准备发布 v1.6.5，包含册子视图页码定位优化和全屏退出后的点击方向修复。
当前改动已完成浏览器回归、Vite 生产构建和规则测试，待提交、推送标签并确认 Pages 部署。

# 已完成
- [x] 上传页三条路径：单页文档 / 双页文档 / 混合文档，使用 Ant `Segmented`
- [x] 三路径上传模块标题「拖入 PDF 文件，或点击选择」与 100 MB 提示统一
- [x] 三路径「适合的文档：」文案与图像说明（含页码：封面、1、2…、封底）
- [x] `Segmented` 统一浅绿选中底 + 深绿字、无阴影、hover 只变色不加底、图标文字居中
- [x] `src/lib/doublePageScan.js`：pdfjs 渲染 → canvas 切半 → JPEG 嵌入 pdf-lib，修复双页白页
- [x] `src/lib/splitScan.js`：混合文档宽高比 ≥1.5 的宽图拆为前后页
- [x] `SheetView` faces 越界 clamp，修复 A6 切换「页面出错了」
- [x] `exportPdf.js` 修复 A6 双页导出内容上下颠倒（移除多余 180° 补偿，锚点改通用旋转公式）
- [x] `styles.css` 移除纸张视图的中缝阴影
- [x] `FlipView` 书脊间距几何对齐纸张视图（内容宽 `sheetWidth/2 - gap/2`，内缩 `gap/2`）
- [x] 三个提交推送 main，创建标签与 GitHub Release v1.6.0，Pages 自动部署成功
- [x] 混合文档改为按页面尺寸判断：宽高比 ≥ 1.5 直接拆分；1.2～1.5 结合文档内单页宽度和高度容差辅助判断
- [x] 混合文档不再要求每页恰好一张图片，文本、矢量和多图片页面不再阻断处理
- [x] `mixedPageRules.js` 提供纯规则函数，并通过 Node 规则用例验证
- [x] 混合文档说明文案同步更新；双页文档代码和文案未改
- [x] 修复 `pageEntries` 使用 `pageWidth/pageHeight`、规则函数读取 `width/height` 导致拆分数恒为 0 的字段名不一致
- [x] 用真实 21 页混合 PDF 验证：第一页 `540×540pt`，后续 20 页 `960×540pt`；修复后 `21 → 41`，20 个宽页全部拆分
- [x] 混合文档拆分页贴书脊对齐：源对开页左半页贴输出页右边，右半页贴输出页左边，单页仍居中
- [x] 工作区换文件按钮 loading 显示简洁页码进度（如 `5/21页`），上传页进度文案不变
- [x] v1.6.1 推送 main，标签与 GitHub Release 已创建，Pages 自动部署
- [x] 混合文档拆分输出改为每个输出页使用自己的裁后尺寸，不再使用整份文件的最大页框
- [x] 保留双页文档模式原有的统一输出页尺寸行为，避免影响既有双页路径
- [x] v1.6.2 推送 main，标签与 GitHub Release 已创建，Pages 自动部署
- [x] A6 空白页补页单位与 A5 对齐：`blankCount` 改用固定 4 页折叠单位，不再按 `pagesPerSheet`
- [x] A6 拼版改为「一张 A4 = 上下两个独立 4 页骑马订单元」，与手动叠放装订的实物结构一致
- [x] 新增 `plan.printedSides`（实际 A4 张数），侧栏与导出面板显示该值而非 `plan.sheets`
- [x] 单数折叠纸时最后半张 A4 输出 `{ kind: 'outside' }` 占位，`Slot` 渲染为空槽，修复 `Cannot read properties of undefined (reading 'kind')` 崩溃
- [x] 新增 `scripts/check-booklet-rules.mjs` 规则用例，0～80 页覆盖 A5/A6 补页一致性与槽位完整性
- [x] v1.6.3 推送 main，标签与 GitHub Release 已创建，Pages 自动部署
- [x] 导出朝向对齐两个预览：A5 槽位不再对横向源页补转 90°，A6 槽位竖向源页改为顺时针（与预览 `forceLandscape` 一致）
- [x] `/Rotate` 补偿取反并归一：pdf.js 按 /Rotate 顺时针显示，pdf-lib `drawPage` 是逆时针，新增 `normalizeQuarterTurn`
- [x] 裁剪比例按「显示方向」反算回 MediaBox 坐标，`/Rotate 90/180/270` 下的拆分裁剪不再错位
- [x] 去掉导出时的非等比拉伸，改为与预览一致的等比缩放并居中留白
- [x] 修复册子视图白页：`renderPageImage` 不再在 `page.render()` 前 `clip()`，改为渲染后按
      书脊留白遮白；双页/混合文档在册子视图恢复显示，书脊间距行为不变

# 待办
- [ ] 用 `测试文件.pdf`（27 页全横向、`/Rotate 0`）在浏览器验收 A5 导出的朝向、页序与清晰度
- [ ] 用带 `/Rotate` 元数据的文件（如 `airplane.pdf`，`/Rotate 90`）验收导出方向
- [ ] 用真实 PDF 验收三条路径的页序、朝向、清晰度与报错提示，收集反馈
- [ ] 补充验收 1.2～1.5 对开页和普通横向单页的边界判断
- [x] 提交本次修复并发布 v1.6.4：推送 `main`、创建并推送 `v1.6.4` 标签，Pages 部署成功
- [x] 创建 GitHub Release v1.6.4：https://github.com/catjumptosea/booklet-printer/releases/tag/v1.6.4
- [x] 册子视图底部页码改为成册页序区间：封面 `1 / N`，中间 `2-3 / N`，封底 `N / N`
- [x] 册子视图跳转输入改为书页页码，输入任一页会定位到包含该页的跨页

## 决策 4：A6 是对折两次的缩小版 A5，而非双册拼版
- 背景：v1.4.0 引入 A6 时把补页单位与纸张面数都换成 `pagesPerSheet`（A6=8），导致同样内容页数下 A6 比 A5 多补空白页
- 选项：按 8 的倍数补（一张 A4 印两本） / 按 4 的倍数补（缩小版 A5，一本）
- 选择：按 4 的倍数补。A6 实物为一张 A4 上下两张 A6 纸、各自对折后手动叠放装订，装订结构与 A5 相同
- 影响：A5/A6 空白页数恢复一致；`plan.sheets` 表示折叠纸数，新增 `plan.printedSides` 表示实际 A4 张数
- 回滚：还原 `blankCount` 使用 `pagesPerSheet`，并恢复 A6 单一 8 面拼版分支

## 决策 5：导出朝向以两个预览为唯一基准
- 背景：部分文件在翻页视图和纸张视图都正常，导出后内容多转 90°
- 原因：预览走 pdf.js，`getViewport` 自动应用 `/Rotate`；导出走 pdf-lib，`embedPage` 只搬运内容流、不携带 `/Rotate`，`getSize()` 也只读 MediaBox。原先的手工补偿方向与 pdf.js 相反，且对 A5 槽位多补了一次 1/4 圈，还把内容非等比拉伸到整个槽位
- 选项：让预览对齐导出 / 让导出对齐预览
- 选择：让导出对齐预览（用户以两个预览为准）
- 影响：A5 横向源页不再旋转、等比居中留白；A6 竖向源页改为顺时针；带 `/Rotate` 的文件导出方向与阅读器一致
- 回滚：`targetAngle` 还原为 `(metaAngle + (needsQuarterTurn ? 90 : 0)) % 360`，并恢复 A5 的 `needsQuarterTurn` 与 `fitToBox` 拉伸分支

# 关键决策
## 决策 1：纸张视图的间距模型为准
- 背景：册子视图与纸张视图的书脊间距效果不一致
- 选项：以册子视图为准 / 以纸张视图为准
- 选择：以纸张视图为准（整纸宽度恒定，间距从两页内容宽各扣一半）
- 理由：纸张视图符合实际打印纸张的物理尺寸
- 影响：册子视图原先间距被放大一倍、内容偏窄，现两视图内容宽与可见间距完全一致
- 回滚：还原 `src/components/FlipView.jsx` 的几何辅助函数与其内缩调用

## 决策 2：双页/混合文档统一转成单页 PDF
- 背景：双页文档处理后册子视图白屏
- 选择：用 pdfjs 渲染源页到 canvas，切半后以 JPEG 嵌入 pdf-lib，产出真正的单页 PDF
- 影响：不是元数据变换，工作区内是归一化后的单页文件，导出即基于该文件

## 决策 3：版本号升级为 1.6.0
- 背景：本次新增三条上传路径，属于向后兼容的功能新增
- 选择：`1.5.5` → `1.6.0`，与既有 `chore: release vX.Y.Z` 提交模式保持一致

# 文件变更
- `src/App.jsx`：三路径状态、拆分流程、返回上传、换文件、徽标、顶部 message
- `src/components/Dropzone.jsx`：Segmented 切换、三条路径说明模块
- `src/components/FlipView.jsx`：书脊间距几何对齐纸张视图
- `src/components/SheetView.jsx`：faces 越界 clamp
- `src/lib/exportPdf.js`：A6 双页导出朝向修复
- `src/lib/doublePageScan.js`：新增（双页拆分）
- `src/lib/splitScan.js`：新增（混合文档拆分）
- `src/lib/mixedPageRules.js`：本次新增，混合文档页面尺寸与单页宽度辅助判断
- `src/lib/splitScan.js`：混合文档输出页改为按自身裁后尺寸写入；双页模式保留独立的统一尺寸辅助函数
- `src/components/Dropzone.jsx`：本次更新混合文档说明，不再提示图片/元素报错
- `src/styles.css`：Segmented、上传布局、说明模块、中缝阴影移除
- `AGENTS.md`：新增项目规则，含「禁止 `git add -f` 提交 release/dist 等忽略目录」
- `docs/handoff/2026-09-14-split-upload.md`：上一阶段 handoff 归档
- `src/lib/exportPdf.js`：导出朝向对齐预览（`/Rotate` 取反、A5 不再补转、A6 顺时针）、裁剪比例按显示方向反算、等比缩放去掉拉伸

# 运行与测试
- 命令：`node node_modules/vite/bin/vite.js build`：通过
- 命令：`node scripts/inline-dist.mjs`：通过，生成 standalone `dist/index.html`
- 命令：`pnpm build`：未跑通；失败于 pnpm 依赖状态检查需网络/TTY，不是编译错误
- 项目未配置测试框架；无自动测试
- 2026-09-15 本次验证：`mixedPageRules.js` 规则用例通过；`node node_modules/vite/bin/vite.js build` 与 `node scripts/inline-dist.mjs` 通过
- 2026-09-15 真实浏览器处理验证：`从前有个月饼村-混合.pdf` 由 21 页拆成 41 页，输出页尺寸为 `540×540pt`
- 2026-09-15 对齐验证：同一真实文件中，输出页宽 `540pt`、半页内容宽 `480pt`；左半页横坐标 `x=60`（贴右），右半页 `x=0`（贴左），单页仍居中
- 2026-09-15 浏览器验收：工作区替换混合文档时，按钮依次显示 `替换中 → 2/21页 → … → 21/21页 → 换文件`
- Playwright 手工测量：间距 0/10/30mm 下，纸张视图与册子视图内容宽一致（420.00 / 405.86 / 377.58）
- GitHub Actions「Deploy to GitHub Pages」：run 34823675857，success，40s
- 2026-09-18：`node node_modules/vite/bin/vite.js build` 通过
- 2026-09-18：`node scripts/inline-dist.mjs` 通过，生成 standalone `dist/index.html`
- 2026-09-18：混合规则用例通过；以 `活页夹1.pdf` 的页面尺寸验证第 19 页仍判定为双页
- 2026-09-18：浏览器级真实文件验收未完成，浏览器连接未返回页面状态；需后续在可用浏览器中确认第 19 页工作区视觉边距
- 2026-09-18：`node scripts/check-booklet-rules.mjs` 通过，0～80 页 A5/A6 补页数与总页数全部一致，槽位无重复无缺失
- 2026-09-18：Chrome 浏览器验收 A6（20 页样例，3 张 A4）：第 1 张上下半区 P20/P1+P2/P19 与 P18/P3+P4/P17，5 个折叠单元按序叠放即 20 页一本；最后半张 A4 渲染为空槽，无崩溃
- 2026-09-21：`node scripts/check-booklet-rules.mjs` 通过（ALL RULE CASES PASS）
- 2026-09-21：`node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs` 通过，生成 standalone `dist/index.html`
- 2026-09-21：像素级对照脚本 `E:\coco\diag\slot-compare.mjs`（dev 工具，不在仓库内）量化修复前后差异
  - 修复前 `测试文件.pdf` A5：预览内容框 `{x:0,y:0.198,w:1,h:0.604}`，导出 `{x:0,y:0,w:1,h:1}`，导出等于预览逆时针转 90°（bestFit=270）
  - 修复后同一文件：预览与导出内容框一致，bestFit=0，MAE 0.82
  - 同一个 `测试文件.pdf` 第 1/14/27 页均 bestFit=0，内容框逐项一致
  - 合成探针覆盖 竖/横 × `/Rotate 0/90/180/270` × A5/A6 共 12 组，修复后全部 bestFit=0
  - 拆分（horizontal 裁剪）路径 4 组（含 `/Rotate 90/270`）修复后全部 bestFit=0
  - 书脊间距 10mm/30mm：方向 bestFit=0，内容保持等比并按 gap/2 内缩
- 2026-09-21：Chrome 无头浏览器端到端验收（`E:\coco\diag\e2e-export-check.mjs`，dev 工具，不在仓库内）
  - 通过上传区真实选取 `测试文件.pdf` 完成 27 页上传，进入工作区并成功触发生成下载
  - 导出 PDF 共 14 张 A4，第一张纸右槽内容框 `{x:0,y:0.198,w:1,h:0.604}`，与槽位对照基准一致
  - 控制台仅有 2 条 antd 废弃 API 告警（InputNumber `addonAfter`、Alert `message`），与本修复无关

# 未解决问题与风险
- 三路径的朝向提醒只做了文案提示，未做自动纠偏
- 大页数（约 300 页）处理慢；大图有 canvas 像素上限保护
- 归一化输出统一 `image/jpeg` 质量 0.92，透明 PNG 可能出现白底
- GitHub Release 未附构建产物压缩包（与 v1.5.4 一致），如需要请另行上传
- 混合文档现在会保留每个输出页的自身尺寸，最终显示大小由当前打印纸槽位等比适配；需要真实 PDF 继续验收不同尺寸页面的朝向、清晰度和边距
- 导出朝向现在与两个预览严格一致；横向源页在 A5 下会等比居中留白（不再补转填满），需要真机打印确认可接受
- A6 竖向源页的旋转方向由逆时针改为顺时针以对齐预览，依赖旧方向的打印习惯需重新验收

# 下一步最小行动
1. 在 `http://127.0.0.1:5173/` 用 `测试文件.pdf` 验收 A5 翻页/纸张视图与导出 PDF 的朝向、页序、清晰度
2. 用 `airplane.pdf`（`/Rotate 90`）验收带元数据旋转的文件
3. 在 GitHub Release v1.6.4 页面补充后续用户反馈或验收说明

# 踩坑与禁止事项
- 现象：`git fetch/push` 报 `git: 'remote-https' is not a git command`
- 原因：本环境的 git 未在 exec-path 中找到 `git-remote-https.exe`
- 规避动作：`git --exec-path='C:\Users\yu_tan\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\mingw64\bin' <cmd>`
- 现象：`pnpm build` 触发依赖安装并因网络失败
- 原因：pnpm 版本检查/安装流程需要网络和 TTY
- 规避动作：本地验证用 `node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs`
- 现象：PowerShell 控制台回显中文乱码
- 规避动作：用 `node -e "fs.readFileSync(...,'utf8')"` 读取确认，文件本身是正常 UTF-8
- 禁止：不要用 `git add -f` 提交 `release/`、`dist/`、`node_modules/`、`diag/`

# 相关链接
- GitHub Release：https://github.com/catjumptosea/booklet-printer/releases/tag/v1.6.0
- 部署流程：`.github/workflows/deploy-pages.yml`

## 决策 6：扫描绘本按 PDF 页面显示尺寸归一化
- 背景：源 PDF 每页来自扫描图片，页面可能是单页或双页，单页之间尺寸也可能不同；不能使用图片 intrinsic 像素尺寸作为几何基准。
- 三条路径：
  - 单页文档：页面原样进入后续排版。
  - 双页文档：先输出第一页显示右半（封面），再按中间页“左半、右半”输出，最后输出第一页显示左半（封底）。
  - 混合文档：对页面自身显示宽高比 `>= 1.5` 的页面，按显示坐标“左半、右半”输出，不套用封面/封底重排。
- 实现：新增 `src/lib/pageGeometry.js` 和 `src/lib/pageNormalize.js`。每个源页只嵌入一次，左右半共享同一个嵌入资源，裁切基于源 PDF 的 MediaBox 坐标；输出页保留源页 `/Rotate`，预览与导出共用同一套显示坐标换算。
- 文本/矢量兼容：不再走 pdf.js canvas + JPEG 重编码，直接嵌入并裁切源 PDF 页面；缺少 Contents 的空白扫描页按空白页处理。
- 排版：最终 PDF 槽位由纸张和册子类型决定，页面等比最大适配，靠近书脊排列；`spineGap=0` 时两页内容贴齐中线。

## 本轮验证（2026-09-21）
- `node scripts/check-booklet-rules.mjs`：`ALL RULE CASES PASS`
- `node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs`：通过，生成 standalone `dist/index.html`
- `E:\coco\diag\normalize-check.mjs`：`NORMALIZE CASES PASS`，覆盖不同页面尺寸、双页顺序、混合页左右拆分与共享嵌入资源。
- `E:\coco\diag\rotation-check.mjs`：`ROTATION CASES PASS`，用 pdf.js 显示结果比对 `/Rotate 0/90/180/270`，确认双页输出第 1 页对应显示右半、第 2 页对应显示左半，无额外旋转。
- `E:\coco\diag\slot-compare.mjs`：真实 `测试文件.pdf`、双页/混合归一化产物以及 `/Rotate 0/90/180/270` 旋转探针均为 `bestFit=0`，预览与导出一致。

## 决策 7：预览渲染改为「渲染后遮白」而非「渲染前裁剪」
- 背景：双页/混合文档在册子视图整页空白，纸张视图正常；两者用同一个 `pdfDoc`，只是渲染函数不同。
- 排查：在 `renderPageImage` 内加像素探针，按显示页记录暗像素比例。单页文档 27 页全部有内容；
  双页文档 54 页、混合文档 35 页全部 `dark≈0`。对同一 `page`/`viewport` 做 A/B：
  `无 clip` 得到内容（如第 1 页 `0.806`），`加 clip` 得到 `0`，`只加 setTransform` 仍有内容。
- 结论：`page.render()` 之前调用 `ctx.clip()` 会让 pdf-lib 重新嵌入的 Form XObject 页面整体消失。
- 选择：保留原来的 `translate` 定位，删掉渲染前的 `setTransform`/`beginPath`/`rect`/`clip`，
  在渲染完成后用白色 `fillRect` 遮住书脊内缩区域。视觉结果与原来一致，书脊间距不影响内容。
- 回滚：把渲染前的 `clip()` 加回 `renderPageImage`，并删除渲染后的遮白分支。

## 本轮验证（2026-09-22）
- `node scripts/check-booklet-rules.mjs`：`ALL RULE CASES PASS`
- `E:\coco\diag\normalize-check.mjs`：`NORMALIZE CASES PASS`
- `E:\coco\diag\rotation-check.mjs`：`ROTATION CASES PASS`
- `node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs`：通过
- 真实 `测试文件.pdf` 三条路径截图暗像素比例（修复前 → 修复后）：
  单页 `0.286 → 0.286`；双页 `0.000 → 0.403`；混合 `0.000 → 0.286`
- 书脊间距 0/10/30 mm：册子视图均有内容（`dark≈0.40`），纸张视图内容宽随间距递减
  （`350 → 338 → 314 px`），两视图仍一致

## 本轮验证（2026-09-22 晚 · 册子视图白页收尾）
- 根因再确认：`renderPageImage` 直接在预先 `translate/rotate` 过的 context 上调用
  `page.render()`。pdf.js 绘制时会重写目标 context 变换，pdf-lib 重新嵌入的分层
  Form XObject 会被推到画布外，槽位只剩白底；纸张视图走 `PageCanvas`，没有这段
  预变换，所以一直正常。
- 修复：`renderPageImage` 改为**始终**先用普通 viewport 把源页渲染到离屏 canvas，
  再按裁剪/旋转/书脊锚点 `drawImage` 合成；裁剪页与非裁剪页共用同一条路径。
- 加固：`syncPageImageLoadState` 在生产中所有源图都已 `preloadImage` 的前提下，直接
  把 page-flip 的 `page.isLoad` 置真并持续重绘，彻底消除白色 loader 帧。
- 回归（dev `http://127.0.0.1:5173/`，真实 `测试文件.pdf`，逐跨页像素统计）：
  单页 15 跨页 / 双页 29 跨页 / 混合 19 跨页，均无 console error；
  除尾部补白页与预览虚拟页外，无整半页纯白。
- 回归（A4+A6 与书脊间距 30mm）：`mixed-a6-gap30` 19 跨页、`double-a6-gap30`
  29 跨页、`mixed-a5-gap30` 19 跨页，仅尾部补白/虚拟页为白，其余均有内容。
- 全屏高清 `updateFromImages()` 路径复测：跨页内容正常，无白页。
- `node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs`：通过；
  `dist/index.html` 已更新（双页首跨页左右 `nonWhite = 1.000 / 0.818`）。
- 遗留：本地修复尚未提交；GitHub Pages 上的 v1.6.3 仍是修复前代码，若要线上生效需
  提交并推送触发部署。

## 发布记录（2026-09-22 · v1.6.4）
- 代码提交 `bd0093d`：扫描 PDF 页面几何归一化、导出朝向对齐预览、册子视图白页修复、
  `docs/PITFALLS.md` 经验库。
- 发布提交 `ba8556e`：`package.json` 版本更新为 `1.6.4`。
- 已推送 `main` 和标签 `v1.6.4`；GitHub Actions「Deploy to GitHub Pages」运行成功。
- GitHub Release 已创建：https://github.com/catjumptosea/booklet-printer/releases/tag/v1.6.4

## 本轮任务（2026-09-23 · 册子视图页码）
- 背景：36 页成册后册子视图显示 `3 / 19`，其中 `19` 是翻开视图数，不是用户熟悉的书页页码。
- 改动：`src/components/FlipView.jsx` 新增跨页页码区间换算；封面/封底显示单页，
  中间跨页显示两页区间；跳转输入范围改为 `1..plan.total`，输入页码后定位到对应跨页。
- 验证：Vite 生产构建通过；`scripts/check-booklet-rules.mjs` 返回 `ALL RULE CASES PASS`。
- 浏览器验证（18 页 PDF，补页后 20 页）：
  - 初始：`1 / 20`
  - 输入 `7`：`6-7 / 20`
  - 输入 `20`：`20 / 20`
  - 输入框提示：`1-20`
  - 控制台只有既有 antd 废弃 API 警告，无本改动相关错误。
- 遗留：该改动将随 v1.6.5 一起发布。

## 本轮任务（2026-09-23 · 全屏退出点击方向）
- 现象：册子视图进入全屏再退出后，点击书页右侧会退回前一跨页；退出后立刻点击最容易复现。
- 根因：`page-flip` 在 `Render.boundsRect` 中缓存书页区域。退出全屏时 DOM 已缩回普通尺寸，但缓存仍是全屏的 `1346×952`，点击仍按全屏宽度分半，视觉右页被判定为内部左半区。
- 修复：全屏进入/退出时刷新 `page-flip` 布局缓存；在书页宿主的 `mousedown` / `touchstart` 捕获阶段按当前 DOM 再刷新一次，确保退出后的第一次点击也使用最新边界。
- 验证：
  - 退出全屏后立即点击右侧：`6-7 / 20 → 8-9 / 20`
  - 随后点击左侧：`8-9 / 20 → 6-7 / 20`
  - 点击时内部 `renderRect` 恢复为 `642×454`，与 DOM 的 `.stf__canvas` 一致
- 构建：Vite 生产构建通过；`scripts/check-booklet-rules.mjs` 返回 `ALL RULE CASES PASS`；`scripts/inline-dist.mjs` 通过。
- 经验记录：`docs/PITFALLS.md` 已补「册子视图退出全屏后，点击右侧变成向前翻页」。

<!-- HUMAN:START -->
<!-- HUMAN:END -->
