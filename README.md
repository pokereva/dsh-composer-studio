# dsh-composer-studio

把 DSH 的消息输入框变成真正的编辑器：默认模式**完全等于原版**；切到 Markdown 模式后，整个输入框变成**沉浸编辑窗**——同一块矩形边写边渲染 Markdown，拖顶边调高，发送只能点按钮。全部行为可以在设置里一键开关。

> DSH (DeepSeek Harness) 插件 · [MIT License](./LICENSE) · 零依赖、纯客户端

DSH 内核把 `Enter`、`Shift + Enter`、`Ctrl / Cmd + Enter` 这三组注册成了 *fixed input*（固定输入），会出现在「设置 → 通用 → 快捷键」里，但**只读、不允许改写**。所以插件只能在事件到达内核之前接管——而且只在 Markdown 模式下接管。

## 行为

| 手势 | 默认模式 | Markdown 模式 |
| --- | --- | --- |
| `Enter` | 发送（DSH 原版） | 插入换行，并自动延续上一行的列表 / 引用标记 |
| `Shift + Enter` | 换行（DSH 原版） | 换行（同左） |
| `Ctrl / Cmd + Enter` | 发送（DSH 原版） | 也被改写成换行，不会发出消息 |
| 点击发送按钮 | 发送 | 发送（Markdown 模式下唯一发送方式） |

- **默认模式一个字节都不拦**：插件在捕获监听的第一道守卫就 `return`，`preventDefault` 都不会调，DSH 的 Enter 发送 / Shift+Enter 换行 / Ctrl+Enter 发送原样保留。
- 设置里关掉**总开关**，任何模式下插件都完全不接管键盘。
- 输入法组合中（`isComposing` / `keyCode 229`）不接管，中文、日文输入不会被打断。
- `/` 斜杠命令与 `@` 提及菜单打开时不接管，`Enter` 仍然是「选中当前候选」；Markdown 辅助键也一并放行。
- 长按不重复触发；只在 `keydown` 首次触发时动作。
- 输入框之外（别处的输入框、终端、对话框）不接管。

## 两种模式

| 模式 | 说明 |
| --- | --- |
| `默认` | 与 DSH 原版完全一致：Enter 发送、Shift + Enter 换行、Ctrl / Cmd + Enter 发送。插件不拦任何键。 |
| `Markdown` | 整个输入框展开成沉浸编辑窗：同一块矩形，失焦时显示渲染结果、点一下就地编辑原生文本；发送只能点按钮；外加一组 Markdown 输入辅助；拖顶边可调高度。 |

Markdown 模式下多出来的按键（只在焦点位于输入框、且 `/` 或 `@` 菜单没打开时生效）：

| 按键 | 插入 |
| --- | --- |
| `Tab` / `Shift + Tab` | 两个空格（`Shift + Tab` 只吞掉，不插入） |
| `Ctrl / Cmd + 1 / 2 / 3` | `# ` / `## ` / `### ` |
| `Ctrl / Cmd + B / I / E` | `**加粗**`、`*斜体*`、`` `行内代码` ``（有选中内容时包裹选区） |
| `Alt + 7` / `Alt + 8` | `- ` / `1. ` |
| `Alt + 9` / `Alt + 0` | `- [ ] ` / `> ` |
| `` Alt + ` `` / `Alt + H` | 代码围栏 / 分隔线 |

列表续行：在 `- `、`1. `、`- [ ] `、`> ` 结尾的行上按 Enter，下一行会自动补上同名标记；在**空条目**上再按一次 Enter 则结束这个列表（不会留下一个空标记）。

### 沉浸编辑窗

Markdown 模式下插件把卡片撑开：画布高度抬到 `--dcs-canvas`（默认 `340px`），渲染层和输入框**占的是同一块矩形**——始终只有一个输入窗口，不是左右两栏、也不是另开一个面板。

同一个矩形两副面孔：

- **没在打字**：渲染层铺满，看到的是排版好的 Markdown。
- **点一下就编辑**：渲染层让开，露出 DSH 原来那个 contenteditable，光标、选区、撤销栈、`/` 命令、`@` 提及全是原生的；改完点外面又回到渲染。

焦点进出输入框就是这两态的开关，不用记快捷键。右上角三颗按钮：`预览` / `编辑` / `收起沉浸`；`收起沉浸` 直接把模式切回 `默认`，画布收起来。

**拖动顶边改高度**：把鼠标移到画布上边缘（光标变成上下箭头），按住拖动即可，范围 160 – 760 px。拖动过程只改 CSS 变量，松手才落盘，所以跟手不卡；高度存在 `canvas` 字段里，下次进来照旧。

放大只做两件事：给 `<body>` 加 `dcs-immersive` 类名，以及把卡片上的 `--dsh-composer-text-max-height` 指向 `--dcs-canvas`。不碰内核任何哈希类名。

> 沉浸画布没有独立开关：**Markdown 模式本身即画布**。切到 Markdown 就展开、切回默认就收起。

渲染支持标题、引用、代码块、分隔线、有序 / 无序 / 任务列表、加粗 / 斜体 / 行内代码 / 链接（只放行 `http(s)`）。

## 技术做法

插件在 `window` 的**捕获阶段**监听 `keydown`，比内核的两条路径都早：

1. Lexical 把 `keydown` 挂在 contenteditable 根节点（冒泡阶段），再派发 `KEY_ENTER_COMMAND`，composer 的处理器在那里 `preventDefault()` 并提交。
2. `ShortcutsService` 把 `keydown` 挂在 `window` **冒泡阶段**派发可配置命令，捕获回调只做固定序列复位。

捕获阶段 `preventDefault() + stopImmediatePropagation()` 同时切断默认行为和后续传播，两条发送路径都不会被触达。守卫顺序是：总开关 → 模式不是 Markdown 就返回 → 输入法组合 / 已被处理 → 不在输入框内 → `/` `@` 菜单打开 → 自定义发送键 → 自定义换行键 → Markdown 辅助键 → 屏蔽键盘发送。

换行本身不做 DOM 手术，而是向输入框补发一次 **合成的 `Shift + Enter`** `keydown`：

```js
root.dispatchEvent(new KeyboardEvent('keydown', {
  key: 'Enter', code: 'Enter', shiftKey: true,
  bubbles: true, cancelable: true, composed: true,
}));
```

因为 composer 的 `KEY_ENTER_COMMAND` 处理器遇到 `event.shiftKey === true` 会 `return false`，把控制权交回 Lexical 的默认处理器，那条路径插入的是 `LineBreakNode`——纯 JS 的文档变更，不依赖浏览器默认动作，所以 `isTrusted: false` 的合成事件照样有效。撤销栈、光标、组合输入、文档模型全部仍由 DSH 自己维护。补发期间用 `state.synthetic` 标记，让本插件自己的监听跳过这一次。

插入 Markdown 模板文本走 DSH 自己的输入 API，而不是 `execCommand`：

```js
const span = state.actions.captureInsertion();      // { ...caretSpan, draftRev }
state.actions.insertText('## ', span);              // draftRev 不匹配就返回 false
```

`state.actions` 来自 `conversation.input.overlay` 槽注入的 `inputActions`。走这条路，撤销栈和草稿持久化都由 DSH 保持一致。只有在拿不到 `inputActions` 时，才退化成 `document.execCommand('insertText', ...)`。

沉浸放大不碰任何哈希类名：卡片本身 `position: relative`，DSH 的滚动容器写的是 `max-height: var(--dsh-composer-text-max-height)`，所以插件只改这个 CSS 变量，再给 `body` 挂 `dcs-immersive` 类。

## 自定义

**设置 → 输入框工作室**（`settings.section` 槽，order 14）：

| 卡片 | 作用 |
| --- | --- |
| 总开关 | 一键启用 / 停用全部接管；关掉即完全复原 |
| 模式 | `默认` ↔ `Markdown` 分段切换 |
| 按键映射 | 「发送消息」「插入换行」两行，各带 *录制 / 清除 / 取消* |
| 行为 | 「屏蔽所有键盘发送」：连 `Ctrl / Cmd + Enter` 也换成换行 |
| Markdown 输入辅助 | 上面那张按键表的只读说明 |
| 沉浸编辑窗 | 说明 Markdown 模式即画布（无独立开关）；展开后可拖动画布顶边调整高度（160 – 760 px），高度也会保存，另有「恢复默认高度」按钮 |

录制时按 Esc 取消，纯修饰键会被忽略，两个动作不能共用同一组合键。

配置存在 `localStorage['dsh.composer-studio.v1']`，落盘形状：

```json
{ "enabled": true, "mode": "markdown", "canvas": 340,
  "bindings": { "newline": { "code": "Enter", "shift": false, "...": "..." }, "send": null },
  "blockKeyboardSend": true }
```

`send: null` 表示「没有键盘发送，只能点击」；`canvas` 是沉浸画布高度（160 – 760，越界自动钳制）。旧版本的 `dsh.composer-keys.v1` 会被自动读取并迁移。改完立即生效，不需要刷新。

其余快捷键仍然在「设置 → 通用 → 快捷键」里改——那是 DSH 自带的可编辑快捷键面板，本插件不动它。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch` + `dsh.client`（`platform: web`、`immediately: true`） |
| `cordis.patch.yml` | 往 profile 里 insert 一条 `dsh-composer-studio` |
| `index.js` | Host 半边，空实现（只为让 bundle patch 能挂载） |
| `client.js` | 全部逻辑：捕获监听、合成换行、Markdown 辅助、沉浸渲染、设置面板 |
| `locale/zh.json`、`locale/en.json` | 包级文案（面板文案在 `client.js` 的 `DICT` 里） |
| `icon.svg` | 设置页图标 |
| `test/harness.cjs` | 离线测试台，假 DOM 里跑 22 条用例 |
| `LICENSE` | MIT |
| `PUBLISHING.md` | 发到 GitHub / npm / 插件市场的操作步骤 |

## 安装

### 从源码装（本地开发）

```bash
plugin_manager({ action: 'install_bundle', target: '<本目录绝对路径>' })
```

安装会写成 `link:` 依赖，因此改完 `client.js` 只要**刷新页面**即可，不必重装；改 `package.json` / `cordis.patch.yml` 才需要重启 DSH。

### 从 GitHub 装

```bash
dsh plugin --profile <profile> add github:<owner>/dsh-composer-studio
```

## 验证

```bash
node --check client.js        # 语法
node test/harness.cjs         # 22/22 passed
```

在线验证用 cordis Inspect 查 `settings.section` 的 occupants 里有没有 `composer-studio`、`conversation.input.overlay` 里有没有 `composer-studio-immersive`，可以确认插件确实被页面加载。真实按键行为需要人在 GUI 里按一次。

## 已知边界

- 快捷键录制只识别 `code`（物理键位），与 DSH 自己的快捷键服务一致；同一物理键在不同键盘布局下映射到不同字符是预期行为。
- 「屏蔽所有键盘发送」只拦 `Enter` 及其修饰组合，不会拦截点击或是其他提交入口。
- 沉浸编辑窗不改写输入框：编辑态下露出来的始终是 DSH 自己的 contenteditable，这样 `/`、`@`、撤销栈、组合输入、草稿持久化都不用另造一套。渲染侧是**只读**的。
- 高度只有一份真相（`canvas` 字段）：拖动期间写行内 `--dcs-canvas`，松手才落盘；多标签页之间靠 `storage` 事件同步。
- 渲染器是刻意做小的（约 170 行）：只覆盖对话里真正会用到的语法，不追求 CommonMark 全兼容。
- 沉浸布局依赖 `--dsh-composer-text-max-height` 这个变量；内核若改名，输入框会退化成正常高度，其余功能不受影响。
- 插件不读别的插件的 DOM，只认内核自己打的标记：`[data-composer-input]`、`[data-composer-card]`、`[data-composer-overlay]`、`button[aria-busy]`、`[data-trigger-menu]`。
