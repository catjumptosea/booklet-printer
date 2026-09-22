# AGENTS.md

## 项目简介

Booklet Printer 是一个在浏览器本地处理 PDF 小册子的工具。上传 PDF 后自动补齐所需页面、完成骑马订拼版，提供翻页视图和纸张视图预览，确认无误后可导出双面打印 PDF 或分别导出正面、反面两个 PDF。所有解析、预览和导出均在浏览器内完成，PDF 文件不上传到服务器。

## 技术栈

- React 18 + antd 6 + lucide-react
- Vite 6（开发与构建）、esbuild
- pdf-lib（PDF 导出）、pdfjs-dist（PDF 解析）、page-flip（翻页视图）
- pnpm 包管理（workspace 声明见 `pnpm-workspace.yaml`）

## 目录结构

```
src/
  App.jsx            # 主应用逻辑
  main.jsx           # 入口
  styles.css         # 全局样式
  components/        # UI 组件
    Dropzone.jsx     # PDF 上传区
    ErrorBoundary.jsx
    ExportPanel.jsx  # 导出面板
    FlipView.jsx     # 翻页预览
    PageCanvas.jsx
    SheetView.jsx    # 纸张视图
    Slot.jsx
  lib/
    booklet.js       # 拼版核心逻辑（页面排列、纸张布局）
    exportPdf.js     # PDF 导出
    pdfjs.js         # pdf.js 封装
scripts/
  inline-dist.mjs    # 构建后处理（内联 dist 资源）
.github/workflows/
  deploy-pages.yml   # push main 自动部署 GitHub Pages
PRD.md               # 产品需求文档
```

## 常用命令

```bash
pnpm install     # 安装依赖
pnpm dev         # 启动开发服务器（端口 5173，strictPort）
pnpm build       # 生产构建（vite build + scripts/inline-dist.mjs）
pnpm preview     # 预览生产构建
```

注意：本项目没有配置测试框架和 lint/format 工具。TODO: 待人工确认是否需要补充。

## AI 会话工作流

- 新会话开始：
  1. 先读 `HANDOFF.md`（如果存在）。
  2. 如果 `HANDOFF.md` 指向 `docs/handoff/` 下的文件，读取该文件。
  3. 执行 `git status`、`git log -5 --oneline`。
  4. 对比 `HANDOFF.md` 中的 `last_verified_commit` 与当前 `HEAD`。
  5. 先复述：当前目标、已完成、待办、风险、下一步最小行动。
  6. 提出最多 3 个疑问，等用户确认后再改代码。
- 会话结束前：
  1. 更新 `HANDOFF.md`。
  2. 记录分支、最新 commit、未提交改动、测试状态、下一步。
  3. 不写入敏感信息。

## 代码风格与约束

- 使用 ES Module（`type: "module"`），JSX 用 `.jsx` 扩展名。
- 新增逻辑放在 `src/lib/`，UI 组件放在 `src/components/`。
- 不引入新的依赖除非明确必要；当前依赖列表见 `package.json`。
- 不使用测试框架自动生成的模板代码；没有测试需求时不要添加测试目录。
- 保持中文注释和中文 UI 文案风格一致。

## 安全部署与验证

- push 到 `main` 分支会触发 GitHub Pages 自动部署（Node 20 + pnpm 9，`pnpm install --frozen-lockfile` + `pnpm build`）。
- 提交前至少运行 `pnpm build` 确认构建通过。
- `release/`、`dist/`、`node_modules/`、`diag/` 已在 `.gitignore` 中忽略，不要提交，也不要用 `git add -f` 强制添加。
- 提交前用 `git status --short` 确认没有把构建产物或 release 包纳入本次提交。
- 不在代码或文档中写入 token、密码、密钥、API key 等敏感信息。
- 不执行 `git commit` 或 `git push`，除非用户明确要求。

## 问题经验库

- `docs/PITFALLS.md` 记录已经实际出现过的处理问题和踩坑经验。
- 新会话处理 PDF 解析、页面尺寸、切页、预览、翻页视图或导出相关任务时，先读 `docs/PITFALLS.md` 中与任务相关的条目。
- `AGENTS.md` 只维护入口索引和长期规则，不在本文件展开完整问题复盘。
- 修复非显而易见、可能回归的问题后，在 `docs/PITFALLS.md` 追加现象、根因、修复原则、验证方式和回归风险。

## HANDOFF 读取与更新

- 长期规则写在 `AGENTS.md`，任务状态写在 `HANDOFF.md`。
- `HANDOFF.md` 不会被自动加载，必须在上面的"AI 会话工作流"中规定先读 `HANDOFF.md`。
- 归档目录：`docs/handoff/YYYY-MM-DD-task.md`（如果使用多任务交接）。

<!-- HUMAN:START -->
<!-- HUMAN:END -->
