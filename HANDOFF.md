---
branch: main
last_verified_commit: 03128a9
updated_at: 2026-09-14 16:24
status: in_progress
---

# TL;DR
上传页已从 2 条路径扩展为 3 条（单页/双页/混合文档），并完成 A6 导出颠倒、A6 切换崩溃、
书脊间距两视图不一致等修复。所有改动仍未提交，等待真实 PDF 验收后再决定 commit。

# 当前目标
完善上传三路径与工作区预览/导出的一致性，处于验收前阶段。

# 已完成
- [x] 上传页改为三条路径：单页文档 / 双页文档 / 混合文档，使用 Ant `Segmented`
- [x] 三路径上传模块标题统一「拖入 PDF 文件，或点击选择」，提示统一为 100 MB 说明
- [x] 三路径「适合的文档：」文案与图像说明（含页码：封面、1、2…、封底）
- [x] `Segmented` 统一浅绿选中底 + 深绿字、无阴影、hover 只变色不加底、图标文字居中
- [x] 新增 `src/lib/doublePageScan.js`：pdfjs 渲染 → canvas 切半 → JPEG 嵌入 pdf-lib，修复双页白屏
- [x] 新增 `src/lib/splitScan.js`：混合文档宽高比 ≥1.5 的宽图拆为前后页
- [x] `SheetView` faces 越界 clamp，修复 A6 切换「页面出错了」
- [x] `exportPdf.js` 修复 A6 双页导出内容上下颠倒（移除多余 180° 补偿，锚点改通用旋转公式）
- [x] `styles.css` 移除纸张视图的中缝阴影
- [x] `FlipView` 书脊间距几何对齐纸张视图（内容宽 `sheetWidth/2 - gap/2`，内缩 `gap/2`）

# 待办
- [ ] 用真实 PDF 验收三条路径的页序、朝向、清晰度与报错提示
- [ ] 确认是否提交本批改动；提交前 `git diff` 复查
- [ ] 决定 `AGENTS.md` 目录结构是否补充 `doublePageScan.js` / `splitScan.js` TODO: 待人工确认

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

# 文件变更
- `src/App.jsx`：三路径状态、拆分流程、返回上传、换文件、徽标、顶部 message
- `src/components/Dropzone.jsx`：Segmented 切换、三条路径说明模块
- `src/components/FlipView.jsx`：书脊间距几何对齐纸张视图
- `src/components/SheetView.jsx`：faces 越界 clamp
- `src/lib/exportPdf.js`：A6 双页导出朝向修复
- `src/lib/doublePageScan.js`：新增（未跟踪）
- `src/lib/splitScan.js`：新增（未跟踪）
- `src/styles.css`：Segmented、上传布局、说明模块、中缝阴影移除
- `AGENTS.md` / `HANDOFF.md`：未跟踪，用户侧文件，不要随意覆盖
- 未提交改动：`git diff --stat` 共 6 个已跟踪文件，另含 2 个新增库文件

# 运行与测试
- 命令：`node node_modules/vite/bin/vite.js build`：通过
- 命令：`node scripts/inline-dist.mjs`：通过，生成 standalone `dist/index.html`
- 命令：`pnpm build`：未跑通；失败于 pnpm 依赖状态检查需网络/TTY，不是编译错误
- 项目未配置测试框架；无自动测试
- Playwright 手工测量：间距 0/10/30mm 下，纸张视图与册子视图内容宽一致（420.00 / 405.86 / 377.58）
- 开发服务器：http://127.0.0.1:5173/ 正常（200）

# 未解决问题与风险
- 三路径的朝向提醒只做了文案提示，未做自动纠偏
- 大页数（约 300 页）处理慢；大图有 canvas 像素上限保护
- 归一化输出统一 `image/jpeg` 质量 0.92，透明 PNG 可能出现白底
- 工作区有未提交改动，不要 `git reset` / `git checkout` 回退

# 下一步最小行动
1. 让用户用真实 PDF 跑一遍三条路径，确认页序、朝向、清晰度、报错
2. 验收通过并经确认后，再 `git add` 与 commit（是否包含 `AGENTS.md` 需用户决定）

# 踩坑与禁止事项
- 现象：`pnpm build` 触发依赖安装并因网络失败
- 原因：pnpm 版本检查/安装流程需要网络和 TTY
- 规避动作：本地验证用 `node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs`
- 现象：PowerShell 控制台回显中文乱码
- 规避动作：用 `node -e "fs.readFileSync(...,'utf8')"` 读取确认，文件本身是正常 UTF-8

# 相关链接
- 暂无 PR / issue；部署流程见 `.github/workflows/deploy-pages.yml`

<!-- HUMAN:START -->
<!-- HUMAN:END -->
