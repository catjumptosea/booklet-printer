---
branch: main
last_verified_commit: 03128a9c7d9a52c918823c3f5d13023ee8b3f4ab
updated_at: 2026-09-14 08:18
status: in_progress
---

# TL;DR
拆分上传功能已完整接入上传页和工作区：宽图识别、拆分、统一页面尺寸、直接进入小册子流程、换文件双路径、顶部成功 message 均已完成。当前所有改动未提交，等待真实 PDF 验收后再决定是否 commit。

# 当前目标
完成「拆分上传」工具并优化上传/工作区交互，当前处于验收前阶段。

# 已完成
- [x] 校验 PDF 每页只有一张图片且无其他元素，否则在拆分路径报错
- [x] 按图片实际绘制区域判断宽高比，≥ 1.5 时从中间竖向切为前页/后页
- [x] 输出 PDF 页面尺寸统一为所有图片的最大宽/最大高，图片按比例自适应并居中
- [x] 拆分结果直接进入工作区小册子流程，不提供下载
- [x] 上传页提供「直接上传 / 拆分上传」Tabs，含滑动动画和项目绿主题
- [x] 拆分上传说明模块：5 页示意图、剪刀、前页/后页标注、4 条说明
- [x] 工作区显示「已拆分」徽标；「换文件」下拉支持直接上传和拆分上传
- [x] Booklet Press 图标可返回上传界面
- [x] 移除「恢复原文件」；成功提示改为顶部 message，自动消失
- [x] 两种上传路径的 Tabs 与上传区位置/高度保持一致；中心内容整体上移约 40px

# 待办
- [ ] 用真实 PDF 验收：单页/双页混合、含文字页面报错、拆分后页序与图片清晰度
- [ ] 确认是否提交本批改动；提交前先 `git diff` 复查，不包含未请求的 `AGENTS.md`
- [ ] 决定是否需要更新 `AGENTS.md` 的目录结构，加入 `src/lib/splitScan.js` TODO: 待人工确认

# 关键决策
## 决策 1：按图片实际绘制区域判断宽高比
- 背景：部分 PDF 页面本身是宽尺寸，但页面内图片不是宽图，导致误拆分
- 选择：使用 operator list 计算图片绘制 rect，以 `rect.w / rect.h >= 1.5` 为准
- 影响：拆分判断更接近真实图片内容；较复杂的 PDF 运算符仍需真实验收

## 决策 2：输出 PDF 使用统一定制页面
- 背景：未裁切图片会带原 PDF 页面尺寸，导致合并后页面大小不一致
- 选择：只按图片区域生成新页面，页面宽高取所有结果的 `max(width)`、`max(height)`，图片居中
- 影响：页面大小统一，但部分图片会留白

## 决策 3：拆分结果直接进入工作区
- 背景：用户希望上传后直接继续小册子流程
- 选择：拆分成功自动载入工作区，不提供下载；保留「已拆分」标识
- 影响：已移除原「恢复源文件」能力，后续如需恢复需要另行设计

## 决策 4：路径切换改用 Ant Design Tabs
- 背景：原 Segmented 切换生硬
- 选择：使用 `Tabs` + `animated.inkBar`，项目绿色指示条
- 影响：切换更平滑；通过 CSS 固定 Tabs 与上传区高度，避免切换跳动

# 文件变更
- `src/lib/splitScan.js`：新增，共 334 行（未跟踪）
- `src/App.jsx`：拆分流程、返回上传、换文件下拉、已拆分徽标、顶部 message（+209/-25）
- `src/components/Dropzone.jsx`：直接/拆分 Tabs、拆分说明模块（+113/-5）
- `src/styles.css`：Tabs、上传布局、拆分说明、徽标等样式（+310/-1）
- `AGENTS.md`：未跟踪，共 69 行，用户侧文件，不要随意覆盖

# 运行与测试
- 命令：`node node_modules/vite/bin/vite.js build`：通过
- 命令：`node scripts/inline-dist.mjs`：通过，生成 standalone `dist/index.html`
- 命令：`pnpm build`：未跑通；失败于 pnpm 依赖状态检查尝试安装/网络（`ERR_PNPM_META_FETCH_FAIL` / 无 TTY），不是项目编译错误
- 项目未配置测试框架；无自动测试
- Playwright 手工测量：两种模式 Tabs `44px`、上传区 `254px` 且 y 一致，标签垂直居中偏移 `0`

# 未解决问题与风险
- operator list 校验可能把描边/填充等向量元素视为“非图片”，某些可接受的 PDF 会被拒绝
- 超过一定页数（约 300 页）处理慢；大图有 canvas 像素上限保护
- 拆分输出统一走 JPEG 内嵌，质量固定 0.92，透明 PNG 可能出现白底
- 工作区当前已有未提交改动，不要用 `git reset` / `git checkout` 回退

# 下一步最小行动
1. 让用户用真实 PDF 跑一遍拆分上传，确认页序、清晰度、报错提示
2. 验收通过后，经用户确认再执行 `git add` 与 commit（不包含 `AGENTS.md`，除非用户要求）

# 踩坑与禁止事项
- 现象：`pnpm build` 触发依赖安装并因网络失败
- 原因：本机 pnpm 版本检查/安装流程需要网络和 TTY
- 规避动作：本地验证直接用 `node node_modules/vite/bin/vite.js build` + `node scripts/inline-dist.mjs`
- 验证方式：构建命令退出码为 0，生成 `dist/index.html`

# 相关链接
- 暂无 PR / issue；部署流程见 `.github/workflows/deploy-pages.yml`

<!-- HUMAN:START -->
<!-- HUMAN:END -->
