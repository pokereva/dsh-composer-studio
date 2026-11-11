# dsh-composer-keys

把 DSH 的消息输入框变成真正的文本编辑框：**Enter 只换行，发送只能点按钮**，并且这两条手势可以随手改。

> DSH (DeepSeek Harness) 插件 · [MIT License](./LICENSE) · 零依赖、纯客户端

DSH 内核把 `Enter`、`Shift + Enter`、`Ctrl / Cmd + Enter` 这三组注册成了 *fixed input*（固定输入）——它们会出现在「设置 → 通用 → 快捷键」里，但**只读、不允许改写**。所以「把 Enter 改成换行」没法通过配置实现，只能抢在事件到达内核之前接管。

## 行为

| 手势 | 默认结果 |
| --- | --- |
| `Enter` | 插入软换行，**不发送** |
| 点击发送按钮 | 发送 |
| `Shift + Enter` | 不再是换行键；被「屏蔽所有键盘发送」一并接管为换行 |
| `Ctrl / Cmd / Alt + Enter` | 同上，也不发送 |

- 输入法组合中（`isComposing` / `keyCode 229`）不接管，中文、日文输入不会被打断。
- `/` 斜杠命令与 `@` 提及菜单打开时不接管，`Enter` 仍然是「选中当前候选」。
- 长按不重复触发；只在 `keydown` 首次触发时动作。
- 输入框之外（别处的输入框、终端、对话框）不接管。

## 技术做法

插件在 `window` 的**捕获阶段**监听 `keydown`，比内核的两条路径都早：

1. Lexical 把 `keydown` 挂在 contenteditable 根节点（冒泡阶段），再派发 `KEY_ENTER_COMMAND`，composer 的处理器在那里 `preventDefault()` 并提交。
2. `ShortcutsService` 把 `keydown` 挂在 `window` **冒泡阶段**派发可配置命令，捕获回调只做固定序列复位。

捕获阶段 `preventDefault() + stopImmediatePropagation()` 同时切断默认行为和后续传播，两条发送路径都不会被触达。

换行本身不做 DOM 手术，而是向输入框补发一次 **合成的 `Shift + Enter`** `keydown`：

```js
root.dispatchEvent(new KeyboardEvent('keydown', {
  key: 'Enter', code: 'Enter', shiftKey: true,
  bubbles: true, cancelable: true, composed: true,
}));
```

因为 composer 的 `KEY_ENTER_COMMAND` 处理器遇到 `event.shiftKey === true` 会 `return false`，把控制权交回 Lexical 的默认处理器，那条路径插入的是 `LineBreakNode`——纯 JS 的文档变更，不依赖浏览器默认动作，所以 `isTrusted: false` 的合成事件照样有效。撤销栈、光标、组合输入、文档模型全部仍由 DSH 自己维护。补发期间用 `state.synthetic` 标记，让本插件自己的监听跳过这一次。

## 自定义

**设置 → 输入框快捷键**（`settings.section` 槽，order 14）：

- 「按键映射」两行，各带 *录制 / 清除 / 取消*。录制时按 Esc 取消，纯修饰键会被忽略，两个动作不能共用同一组合键。
- 「行为」卡片可关掉「屏蔽所有键盘发送」，关掉后 `Ctrl / Cmd + Enter` 恢复成内核原有的发送。
- 配置存在 `localStorage['dsh.composer-keys.v1']`，落盘形状 `{ bindings: { newline, send }, blockKeyboardSend }`，并兼容旧的扁平形状。改完立即生效，不需要刷新。

其余快捷键仍然在「设置 → 通用 → 快捷键」里改——那是 DSH 自带的可编辑快捷键面板，本插件不动它。

## 文件

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包清单：`dsh.bundle.patch` + `dsh.client`（`platform: web`、`immediately: true`） |
| `cordis.patch.yml` | 往 profile 里 insert 一条 `dsh-composer-keys` |
| `index.js` | Host 半边，空实现（只为让 bundle patch 能挂载） |
| `client.js` | 全部逻辑：捕获监听、合成换行、设置面板 |
| `locale/zh.json`、`locale/en.json` | 包级文案（面板文案在 `client.js` 的 `DICT` 里） |
| `icon.svg` | 设置页图标 |
| `test/harness.cjs` | 离线测试台，假 DOM 里跑 11 条用例 |
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
dsh plugin --profile <profile> add github:<owner>/dsh-composer-keys
```

## 验证

```bash
node --check client.js        # 语法
node test/harness.cjs         # 11/11 passed
```

在线验证用 cordis Inspect 查 `settings.section` 的 occupants 里有没有 `composer-keys`，可以确认插件确实被页面加载。真实按键行为需要人在 GUI 里按一次。

## 已知边界

- 快捷键录制只识别 `code`（物理键位），与 DSH 自己的快捷键服务一致；同一物理键在不同键盘布局下映射到不同字符是预期行为。
- 「屏蔽所有键盘发送」只拦 `Enter` 及其修饰组合，不会拦截点击或是其他提交入口。
- 插件不读别的插件的 DOM，只认内核自己打的标记：`[data-composer-input]`、`[data-composer-card]`、`button[aria-busy]`、`[data-trigger-menu]`。
