---
branch: main
last_verified_commit: 5bb4fd6
updated_at: 2026-09-15
status: in_progress
---

# TL;DR
v1.6.0 已发布：上传页三条路径（单页/双页/混合文档）全部上线，并修复 A6 导出颠倒、
A6 切换崩溃、书脊间距两视图不一致、双页文档白页等问题。提交已推送 main，
标签 v1.6.0 与 GitHub Release 均已创建，Pages 部署成功。当前本地正在改造混合文档：
改为按页面尺寸拆分，并以文档内单页宽度辅助识别非 1.5 阈值的对开页。

# 当前目标
混合文档改为页面尺寸分割，并让拆分后的半页贴近书脊；工作区换文件按钮显示简洁页码进度；双页文档保持原逻辑不变。本地改动尚未提交。

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

# 待办
- [ ] 用真实 PDF 验收三条路径的页序、朝向、清晰度与报错提示，收集反馈
- [ ] 补充验收 1.2～1.5 对开页和普通横向单页的边界判断
- [ ] 如需修复，开新补丁版本（例如 v1.6.1）并同步更新 `package.json`

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
- `src/components/Dropzone.jsx`：本次更新混合文档说明，不再提示图片/元素报错
- `src/styles.css`：Segmented、上传布局、说明模块、中缝阴影移除
- `AGENTS.md`：新增项目规则，含「禁止 `git add -f` 提交 release/dist 等忽略目录」
- `docs/handoff/2026-09-14-split-upload.md`：上一阶段 handoff 归档

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

# 未解决问题与风险
- 三路径的朝向提醒只做了文案提示，未做自动纠偏
- 大页数（约 300 页）处理慢；大图有 canvas 像素上限保护
- 归一化输出统一 `image/jpeg` 质量 0.92，透明 PNG 可能出现白底
- GitHub Release 未附构建产物压缩包（与 v1.5.4 一致），如需要请另行上传

# 下一步最小行动
1. 提交本次混合文档改动
2. 在需要发布时开 v1.6.1 并同步 `package.json`

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

<!-- HUMAN:START -->
<!-- HUMAN:END -->
