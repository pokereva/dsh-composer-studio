# dsh-composer-studio

把 DSH 的消息输入框变成真正的文本编辑框：**Enter 只换行，发送只能点按钮**；再叠一个可选的 **Markdown 写作模式**（输入辅助 + 实时预览）。全部行为可以在设置里一键开关。

> DSH (DeepSeek Harness) 插件 · [MIT License](./LICENSE) · 零依赖、纯客户端

DSH 内核把 `Enter`、`Shift + Enter`、`Ctrl / Cmd + Enter` 这三组注册成了 *fixed input*（固定输入）——它们会出现在「设置 → 通用 → 快捷键」里，但**只读、不允许改写**。所以「把 Enter 改成换行」没法通过配置实现，只能抢在事件到达内核之前接管。

## 行为

| 手势 | 默认结果 | Markdown 模式 |
| --- | --- | --- |
| `Enter` | 插入软换行，**不发送** | 换行，并自动延续上一行的列表 / 引用标记 |
| 点击发送按钮 | 发送 | 发送 |
| `Shift + Enter` | 不再是换行键；被「屏蔽所有键盘发送」一并接管为换行 | 同左 |
| `Ctrl / Cmd / Alt + Enter` | 同上，也不发送 | 同上 |

- 设置里关掉**总开关**后，插件完全不接管键盘——输入框、快捷键立刻回到 DSH 原生行为（这就是「关闭模式即复原」）。
- 输入法组合中（`isComposing` / `keyCode 229`）不接管，中文、日文输入不会被打断。
- `/` 斜杠命令与 `@` 提及菜单打开时不接管，`Enter` 仍然是「选中当前候选」；Markdown 辅助键也一并放行。
- 长按不重复触发；只在 `keydown` 首次触发时动作。
- 输入框之外（别处的输入框、终端、对话框）不接管。

## 两种模式

| 模式 | 说明 |
| --- | --- |
| `默认` | Enter 换行、发送只能点击。输入框仍是 DSH 原来的 contenteditable，只是手势被改写。 |
| `Markdown` | 在默认行为之上，增加一组 Markdown 输入辅助，并在输入框下方渲染只读实时预览。 |

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

预览是只读的，挂在 `conversation.composer.dock` 槽，支持标题、引用、代码块、分隔线、有序 / 无序 / 任务列表、加粗 / 斜体 / 行内代码 / 链接（只放行 `http(s)`）。草稿为空时自动隐藏。

## 技术做法

插件在 `window` 的**捕获阶段**监听 `keydown`，比内核的两条路径都早：

1. Lexical 把 `keydown` 挂在 contenteditable 根节点（冒泡阶段），再派发 `KEY_ENTER_COMMAND`，composer 的处理器在那里 `preventDefault()` 并提交。
2. `ShortcutsService` 把 `keydown` 挂在 `window` **冒泡阶段**派发可配置命令，捕获回调只做固定序列复位。

捕获阶段 `preventDefault() + stopImmediatePropagation()` 同时切断默认行为和后续传播，两条发送路径都不会被触达。插件的监听器第一步就检查总开关，关掉时直接 `return`，事件原样落到内核手里。

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

`state.actions` 来自 `conversation.composer.dock` 槽注入的 `inputActions`。走这条路，撤销栈和草稿持久化都由 DSH 保持一致。只有在拿不到 `inputActions` 时，才退化成 `document.execCommand('insertText', ...)`。

## 自定义

**设置 → 输入框工作室**（`settings.section` 槽，order 14）：

| 卡片 | 作用 |
| --- | --- |
| 总开关 | 一键启用 / 停用全部接管；关掉即完全复原 |
| 模式 | `默认` ↔ `Markdown` 分段切换 |
| 按键映射 | 「发送消息」「插入换行」两行，各带 *录制 / 清除 / 取消* |
| 行为 | 「屏蔽所有键盘发送」：连 `Ctrl / Cmd + Enter` 也换成换行 |
| Markdown 输入辅助 | 上面那张按键表的只读说明 |
| 预览 | 就是切到 Markdown 模式的另一个入口 |

录制时按 Esc 取消，纯修饰键会被忽略，两个动作不能共用同一组合键。

配置存在 `localStorage['dsh.composer-studio.v1']`，落盘形状：

```json
{ "enabled": true, "mode": "default",
  "bindings": { "newline": { "code": "Enter", "shift": false, "...": "..." }, "send": null },
  "blockKeyboardSend": true }
```

`send: null` 表示「没有键盘发送，只能点击」。旧版本的 `dsh.composer-keys.v1` 会被自动读取并迁移。改完立即生效，不需要刷新。

其余快捷键仍然在「设置 → 通用 → 快捷键」里改——那是 DSH 自带的可编辑快捷键面板，本插件不动它。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch` + `dsh.client`（`platform: web`、`immediately: true`） |
| `cordis.patch.yml` | 往 profile 里 insert 一条 `dsh-composer-studio` |
| `index.js` | Host 半边，空实现（只为让 bundle patch 能挂载） |
| `client.js` | 全部逻辑：捕获监听、合成换行、Markdown 辅助、预览、设置面板 |
| `locale/zh.json`、`locale/en.json` | 包级文案（面板文案在 `client.js` 的 `DICT` 里） |
| `icon.svg` | 设置页图标 |
| `test/harness.cjs` | 离线测试台，假 DOM 里跑 19 条用例 |
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
node test/harness.cjs         # 19/19 passed
```

在线验证用 cordis Inspect 查 `settings.section` 的 occupants 里有没有 `composer-studio`，可以确认插件确实被页面加载。真实按键行为需要人在 GUI 里按一次。

## 已知边界

- 快捷键录制只识别 `code`（物理键位），与 DSH 自己的快捷键服务一致；同一物理键在不同键盘布局下映射到不同字符是预期行为。
- 「屏蔽所有键盘发送」只拦 `Enter` 及其修饰组合，不会拦截点击或是其他提交入口。
- Markdown 预览是**只读渲染**，不在输入框里做富文本编辑：输入框始终是 DSH 自己的 contenteditable，这样 `/`、`@`、撤销栈、组合输入、草稿持久化都不用另造一套。
- 预览的渲染器是刻意做小的（约 170 行）：只覆盖对话里真正会用到的语法，不追求 CommonMark 全兼容。
- 插件不读别的插件的 DOM，只认内核自己打的标记：`[data-composer-input]`、`[data-composer-card]`、`button[aria-busy]`、`[data-trigger-menu]`。
