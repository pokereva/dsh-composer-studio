window.__ModuleLoader__.load({
  // 必须与 package.json 的 name 完全一致：ClientModuleSystem 用这个 id 注册
  // factory，加载器发现「loaded without registering」就会丢掉整个 bundle。
  id: '@local/dsh-composer-studio',
  factory(require) {
    const { createElement: h, Fragment, useCallback, useEffect, useRef, useState } = require('react');

    /* ── 常量 ─────────────────────────────────────────────────────────── */

    const NS = 'composerStudio';
    const STORAGE_KEY = 'dsh.composer-studio.v1';
    const LEGACY_KEY = 'dsh.composer-keys.v1';
    const STYLE_ID = 'dsh-composer-studio/section.css';
    const SECTION_ID = 'composer-studio';
    /**
     * 沉浸编辑窗挂在 overlay 槽里：它渲染在 composer 卡片内部
     * （div[data-composer-overlay]），卡片本身就是 position: relative，
     * 所以整块面板可以严丝合缝地盖在输入框上，而不是在下面另起一块。
     */
    const OVERLAY_SLOT = 'conversation.input.overlay';
    const OVERLAY_ID = 'composer-studio-immersive';
    /** 沉浸状态下给 body 打的标记，卡片放大与面板定位全靠它。 */
    const IMMERSIVE_CLASS = 'dcs-immersive';

    const MODE_DEFAULT = 'default';
    const MODE_MARKDOWN = 'markdown';

    const TAB_TEXT = '  ';

    /**
     * 这两条绑定只在 Markdown 模式下生效。
     * 默认模式一根手指都不碰：Enter 发送、Shift + Enter 换行、Ctrl / Cmd + Enter
     * 发送，全部是 DSH 原样，插件连 preventDefault 都不会调。
     *
     * Markdown 模式是写作模式：
     *   - 换行：Enter（裸 Enter 只换行，写 md 时不会手滑把消息发出去）
     *   - 发送：null —— 只能点发送按钮
     */
    const DEFAULT_BINDINGS = {
      newline: { code: 'Enter', alt: false, ctrl: false, meta: false, shift: false },
      send: null,
    };

    const DEFAULT_BLOCK_KEYBOARD_SEND = true;
    const DEFAULT_ENABLED = true;
    const DEFAULT_MODE = MODE_DEFAULT;
    const DEFAULT_IMMERSIVE = true;

    const CODE_LABELS = {
      Enter: 'Enter',
      NumpadEnter: 'Enter',
      Space: 'Space',
      Tab: 'Tab',
      Backspace: 'Backspace',
      Delete: 'Delete',
      Escape: 'Esc',
      Comma: ',',
      Period: '.',
      Slash: '/',
      Backslash: '\\',
      Backquote: '`',
      Minus: '-',
      Equal: '=',
      Semicolon: ';',
      Quote: "'",
      BracketLeft: '[',
      BracketRight: ']',
      ArrowUp: '↑',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowRight: '→',
      Home: 'Home',
      End: 'End',
      PageUp: 'PageUp',
      PageDown: 'PageDown',
    };

    const MODIFIER_KEYS = [
      'Shift',
      'Control',
      'Alt',
      'Meta',
      'AltGraph',
      'CapsLock',
      'ContextMenu',
      'OS',
      'Fn',
      'Dead',
      'Unidentified',
    ];

    const IS_MAC = /mac|iphone|ipad/i.test(
      (typeof navigator !== 'undefined' && (navigator.platform || navigator.userAgent)) || '',
    );

    /** Alt 系快捷键：只在 Markdown 模式下、且焦点在输入框里时生效。 */
    const MARKDOWN_ALT_INSERTS = {
      Digit7: '- ',
      Digit8: '1. ',
      Digit9: '- [ ] ',
      Digit0: '> ',
      Backquote: '```\n',
      KeyH: '\n---\n',
    };

    /* ── 文案 ─────────────────────────────────────────────────────────── */

    const DICT = {
      zh: {
        nav: '输入框工作室',
        heading: '输入框工作室',
        intro:
          'DSH 把 Enter 固定成「发送」、Shift + Enter 固定成「换行」，输入框也不支持 Markdown。默认模式下本插件什么都不改；切到 Markdown 模式后，整个输入框会变成沉浸编辑窗，边写边渲染，发送改成只能点按钮。',
        cardMaster: '总开关',
        masterTitle: '启用输入框工作室',
        masterDesc: '关闭后完全不接管键盘，输入框和快捷键立刻恢复 DSH 原生行为。',
        cardMode: '模式',
        modeDefault: '默认',
        modeMarkdown: 'Markdown',
        modeDefaultDesc: '与 DSH 原版完全一致：Enter 发送、Shift + Enter 换行、Ctrl / Cmd + Enter 发送，插件不拦任何键。',
        modeMarkdownDesc: '整个输入框变成沉浸编辑窗，边写边渲染 Markdown；发送只能点按钮。',
        cardKeys: '按键映射',
        sendTitle: '发送消息',
        sendDesc: '没有快捷键时只能点击发送按钮；也可以录制一个组合键。',
        sendClickOnly: '仅点击发送',
        newlineClickOnly: '未绑定',
        newlineTitle: '插入换行',
        newlineDesc: '按下这个组合键时在光标处插入换行，不会触发发送。',
        record: '录制',
        clear: '清除',
        recording: '请按组合键…',
        cancel: '取消',
        reset: '恢复默认',
        resetHint: '默认：模式为默认，Markdown 模式下 Enter 换行、发送只能点击。',
        duplicate: '这两个动作不能使用同一个组合键。',
        cardBehaviour: '行为',
        blockTitle: '屏蔽所有键盘发送',
        blockDesc: '连 Ctrl + Enter、Cmd + Enter 也不发送，一律换成插入换行。只影响 Markdown 模式。',
        cardMdKeys: 'Markdown 输入辅助',
        mdKeysIntro: '只在 Markdown 模式下、焦点在输入框里时生效。斜杠命令与 @ 提及菜单打开时一律放行，优先级交给菜单。',
        mdTab: 'Tab',
        mdTabDesc: '插入两个空格',
        mdHeadings: 'Ctrl / Cmd + 1 / 2 / 3',
        mdHeadingsDesc: '插入一至三级标题标记',
        mdLists: 'Alt + 7 / Alt + 8',
        mdListsDesc: '插入无序列表、有序列表标记',
        mdTasks: 'Alt + 9 / Alt + 0',
        mdTasksDesc: '插入任务列表、引用标记',
        mdBlocks: 'Alt + ` / Alt + H',
        mdBlocksDesc: '插入代码块、分隔线',
        mdInline: 'Ctrl / Cmd + B / I / E',
        mdInlineDesc: '加粗、斜体、行内代码（有选中内容时包裹它）',
        mdContinue: 'Enter',
        mdContinueDesc: '换行的同时自动延续上一行的列表或引用标记',
        cardImmersive: '沉浸编辑窗',
        immersiveTitle: '把输入框放大成沉浸编辑窗',
        immersiveDesc: 'Markdown 模式下整个输入框卡片会展开成一块大画布，边写边渲染；点一下画布就能继续输入，切到「源码」可以看见光标。',
        immersiveNote: '只有 Markdown 模式才会展开；默认模式下输入框保持原样。',
        viewRendered: '渲染',
        viewSource: '源码',
        immersiveEmpty: '开始输入，这里会实时渲染 Markdown。',
        immersiveExit: '收起沉浸',
        immersiveHint: '点击继续输入',
        cardMore: '其他快捷键',
        moreHint:
          '其余快捷键在「设置 → 通用 → 快捷键」里改。那里列出的 Enter、Shift + Enter、Ctrl + Enter 属于固定输入，只在这里才能调整。',
      },
      en: {
        nav: 'Composer Studio',
        heading: 'Composer Studio',
        intro:
          'DSH hard-codes Enter as send and Shift + Enter as newline, and the composer has no Markdown support. Default mode changes nothing at all; switch to Markdown mode and the whole composer turns into an immersive editor that renders as you type, with sending moved to the button.',
        cardMaster: 'Master switch',
        masterTitle: 'Enable Composer Studio',
        masterDesc: 'When off, nothing is intercepted and the composer behaves exactly like stock DSH.',
        cardMode: 'Mode',
        modeDefault: 'Default',
        modeMarkdown: 'Markdown',
        modeDefaultDesc:
          'Exactly like stock DSH: Enter sends, Shift + Enter inserts a line break, Ctrl / Cmd + Enter sends. Nothing is intercepted.',
        modeMarkdownDesc:
          'The whole composer becomes an immersive editor that renders Markdown as you type; sending is click-only.',
        cardKeys: 'Key bindings',
        sendTitle: 'Send message',
        sendDesc: 'With no shortcut, sending requires a click on the send button.',
        sendClickOnly: 'Click only',
        newlineClickOnly: 'Unbound',
        newlineTitle: 'Insert line break',
        newlineDesc: 'A line break is inserted at the caret instead of sending.',
        record: 'Record',
        clear: 'Clear',
        recording: 'Press a combination…',
        cancel: 'Cancel',
        reset: 'Restore defaults',
        resetHint: 'Defaults: default mode; in Markdown mode Enter inserts a line break and sending is click-only.',
        duplicate: 'The two actions cannot share one combination.',
        cardBehaviour: 'Behaviour',
        blockTitle: 'Block every keyboard send',
        blockDesc:
          'Ctrl + Enter and Cmd + Enter also insert a line break instead of sending. Markdown mode only.',
        cardMdKeys: 'Markdown helpers',
        mdKeysIntro:
          'Only while Markdown mode is on and the composer has focus. When the slash or @ menu is open, every key is passed through to the menu.',
        mdTab: 'Tab',
        mdTabDesc: 'Insert two spaces',
        mdHeadings: 'Ctrl / Cmd + 1 / 2 / 3',
        mdHeadingsDesc: 'Insert a first, second or third level heading marker',
        mdLists: 'Alt + 7 / Alt + 8',
        mdListsDesc: 'Insert a bullet or ordered list marker',
        mdTasks: 'Alt + 9 / Alt + 0',
        mdTasksDesc: 'Insert a task list or blockquote marker',
        mdBlocks: 'Alt + ` / Alt + H',
        mdBlocksDesc: 'Insert a code fence or horizontal rule',
        mdInline: 'Ctrl / Cmd + B / I / E',
        mdInlineDesc: 'Bold, italic, inline code (wraps the selection when there is one)',
        mdContinue: 'Enter',
        mdContinueDesc: 'Insert a line break and continue the list or quote marker above',
        cardImmersive: 'Immersive editor',
        immersiveTitle: 'Expand the composer into an immersive editor',
        immersiveDesc:
          'In Markdown mode the whole composer card opens up into a large canvas that renders as you type. Click the canvas to keep typing, or switch to Source to see the caret.',
        immersiveNote: 'Only Markdown mode expands the composer; Default mode leaves it untouched.',
        viewRendered: 'Rendered',
        viewSource: 'Source',
        immersiveEmpty: 'Start typing — Markdown is rendered here as you go.',
        immersiveExit: 'Collapse',
        immersiveHint: 'Click to keep typing',
        cardMore: 'Other shortcuts',
        moreHint:
          'Every other shortcut lives in Settings → General → Shortcuts. The Enter, Shift + Enter and Ctrl + Enter entries listed there are fixed input and can only be changed here.',
      },
    };

    /* ── 样式 ─────────────────────────────────────────────────────────── */

    const CSS = `
.dck-section { display: flex; flex-direction: column; gap: 14px; }
.dck-intro { margin: 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; line-height: 1.65; }
.dck-card { border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.1)); border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-layer-1, transparent); overflow: hidden; }
.dck-card-title { padding: 10px 14px; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: var(--dsw-alias-label-secondary, #6b7280); border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08)); }
.dck-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; }
.dck-row + .dck-row { border-top: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06)); }
.dck-row[data-off='true'] { opacity: 0.5; }
.dck-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.dck-text strong { font-size: 13px; font-weight: 600; }
.dck-text span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); line-height: 1.55; }
.dck-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.dck-chip { display: inline-flex; align-items: center; min-height: 26px; padding: 0 10px; border-radius: var(--dsw-radius-md, 8px); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12)); background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.04)); font-size: 12px; white-space: nowrap; }
.dck-chip[data-empty='true'] { border-style: dashed; color: var(--dsw-alias-label-secondary, #6b7280); background: transparent; }
.dck-chip[data-recording='true'] { border-color: var(--dsw-alias-brand-primary, #247bbf); color: var(--dsw-alias-brand-primary, #247bbf); }
.dck-button { font: inherit; font-size: 12px; line-height: 1; padding: 7px 12px; border-radius: var(--dsw-radius-md, 8px); border: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12)); background: transparent; color: inherit; cursor: pointer; }
.dck-button:hover { background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.05)); }
.dck-button:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, #247bbf); outline-offset: 1px; }
.dck-seg { display: inline-flex; gap: 4px; padding: 3px; border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.05)); }
.dck-seg button { font: inherit; font-size: 12px; line-height: 1; padding: 7px 14px; border: 0; border-radius: calc(var(--dsw-radius-md, 8px) - 2px); background: transparent; color: inherit; cursor: pointer; }
.dck-seg button[data-active='true'] { background: var(--dsw-alias-bg-layer-1, #fff); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12); font-weight: 600; }
.dck-seg button:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, #247bbf); outline-offset: 1px; }
.dck-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dck-note { margin: 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; line-height: 1.6; }
.dck-error { margin: 0; color: var(--dsw-alias-state-error-primary, #d92d20); font-size: 12px; }
.dck-switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }
.dck-switch input { width: 15px; height: 15px; margin: 0; accent-color: var(--dsw-alias-brand-primary, #247bbf); cursor: pointer; }
.dck-kv { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; padding: 12px 14px; }
.dck-kv code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; padding: 2px 6px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.06)); white-space: nowrap; }
.dck-kv span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }

/* ── 沉浸编辑窗 ───────────────────────────────────────────────────── */

/* 画布高度：卡片和渲染面板共用同一个值，两边永远对齐。
   卡片多留 var(--dcs-row) 给底部的工具行，面板才不会压住发送按钮。
   --dcs-pad 对齐卡片自己的 padding-top: 8px（内核写的），渲染面板从这里开始。 */
:root { --dcs-canvas: 340px; --dcs-row: 52px; --dcs-pad: 8px; }

body.dcs-immersive [data-composer-card] {
  /* DSH 自己的滚动容器写的就是 max-height: var(--dsh-composer-text-max-height)，
     所以直接改这个变量，不用去碰任何哈希类名。 */
  --dsh-composer-text-max-height: var(--dcs-canvas);
  /* 只是兜底：真正把卡片撑开的是输入框的 min-height，内容比画布长时交给滚动条。 */
  min-height: var(--dcs-canvas);
}
body.dcs-immersive [data-composer-card] [data-composer-input] {
  min-height: var(--dcs-canvas);
  width: calc(50% - 3px);
  max-width: none;
}
body.dcs-immersive.dcs-source [data-composer-card] [data-composer-input] { width: 100%; }

.dcs-pane {
  position: absolute;
  top: var(--dcs-pad);
  right: 0;
  width: calc(50% - 3px);
  height: var(--dcs-canvas);
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.08));
  background: var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-1, transparent));
  border-radius: var(--dsw-radius-md, 8px);
  overflow: hidden;
  z-index: 2;
}
.dcs-pane[data-view='source'] { display: none; }
.dcs-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06)); }
.dcs-title { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary, #6b7280); }
.dcs-tools { display: flex; align-items: center; gap: 6px; }
.dcs-tab { font: inherit; font-size: 11px; line-height: 1; padding: 5px 9px; border-radius: var(--dsw-radius-md, 8px); border: 1px solid transparent; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); cursor: pointer; }
.dcs-tab[data-active='true'] { border-color: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12)); background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.06)); color: var(--dsw-alias-label-primary, inherit); }
.dcs-tab:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, #247bbf); outline-offset: 1px; }
.dcs-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 14px 14px; font-size: var(--dsh-content-font-size, 13px); line-height: 1.68; cursor: text; }
.dcs-empty { margin: 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.dcs-count { font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }

.dcs-md p { margin: 0 0 8px; }
.dcs-md p:last-child { margin-bottom: 0; }
.dcs-md h1, .dcs-md h2, .dcs-md h3, .dcs-md h4, .dcs-md h5, .dcs-md h6 { margin: 14px 0 6px; line-height: 1.35; }
.dcs-md h1:first-child, .dcs-md h2:first-child, .dcs-md h3:first-child { margin-top: 0; }
.dcs-md h1 { font-size: 21px; }
.dcs-md h2 { font-size: 18px; }
.dcs-md h3 { font-size: 16px; }
.dcs-md h4, .dcs-md h5, .dcs-md h6 { font-size: 14px; }
.dcs-md ul, .dcs-md ol { margin: 6px 0 8px; padding-left: 24px; }
.dcs-md li { margin: 3px 0; }
.dcs-md blockquote { margin: 8px 0; padding: 2px 0 2px 12px; border-left: 3px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.16)); color: var(--dsw-alias-label-secondary, #6b7280); }
.dcs-md pre { margin: 8px 0; padding: 10px 12px; border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.06)); overflow-x: auto; }
.dcs-md pre code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.dcs-md :not(pre) > code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; padding: 1px 5px; border-radius: 5px; background: var(--dsw-alias-bg-layer-2, rgba(0, 0, 0, 0.06)); }
.dcs-md hr { margin: 10px 0; border: 0; border-top: 1px solid var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.14)); }
.dcs-md a { color: var(--dsw-alias-brand-primary, #247bbf); text-decoration: none; }
.dcs-md a:hover { text-decoration: underline; }
`;

    function ensureStyles() {
      if (typeof document === 'undefined') return () => {};
      const selector = `style[data-plugin-css="${STYLE_ID}"]`;
      if (document.querySelector(selector) !== null) return () => {};
      const tag = document.createElement('style');
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
      return () => {
        tag.remove();
      };
    }

    /* ── 设置读写 ─────────────────────────────────────────────────────── */

    function defaults() {
      return {
        enabled: DEFAULT_ENABLED,
        mode: DEFAULT_MODE,
        immersive: DEFAULT_IMMERSIVE,
        bindings: { newline: { ...DEFAULT_BINDINGS.newline }, send: null },
        blockKeyboardSend: DEFAULT_BLOCK_KEYBOARD_SEND,
      };
    }

    function normalizeBinding(value, fallback) {
      if (value === null) return null;
      if (typeof value !== 'object' || typeof value.code !== 'string' || value.code === '') {
        return fallback === undefined || fallback === null ? null : { ...fallback };
      }
      return {
        code: value.code,
        alt: value.alt === true,
        ctrl: value.ctrl === true,
        meta: value.meta === true,
        shift: value.shift === true,
      };
    }

    function readSettings() {
      const base = defaults();
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        // 旧版本只存 { bindings, blockKeyboardSend }，读到就顺势升级。
        const source = raw !== null ? raw : window.localStorage.getItem(LEGACY_KEY);
        if (source === null) return base;
        const parsed = JSON.parse(source);
        if (parsed === null || typeof parsed !== 'object') return base;
        const bindings = parsed.bindings || parsed;
        return {
          enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_ENABLED,
          mode: parsed.mode === MODE_MARKDOWN ? MODE_MARKDOWN : MODE_DEFAULT,
          immersive: typeof parsed.immersive === 'boolean' ? parsed.immersive : DEFAULT_IMMERSIVE,
          bindings: {
            newline: normalizeBinding(bindings.newline, DEFAULT_BINDINGS.newline),
            send: normalizeBinding(bindings.send, null),
          },
          blockKeyboardSend:
            typeof parsed.blockKeyboardSend === 'boolean'
              ? parsed.blockKeyboardSend
              : DEFAULT_BLOCK_KEYBOARD_SEND,
        };
      } catch {
        return base;
      }
    }

    function writeSettings(settings) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch {
        /* 隐私模式或配额用尽：本次仍然生效，只是不落盘。 */
      }
    }

    /** 监听器始终读这里：设置面板改完立刻生效，不必重挂监听。 */
    const state = {
      ...readSettings(),
      suspended: false,
      synthetic: false,
      actions: null,
      draft: '',
    };

    const settingsListeners = new Set();
    const draftListeners = new Set();

    function onSettingsChange(listener) {
      settingsListeners.add(listener);
      return () => settingsListeners.delete(listener);
    }

    function onDraftChange(listener) {
      draftListeners.add(listener);
      return () => draftListeners.delete(listener);
    }

    function snapshot() {
      return {
        enabled: state.enabled,
        mode: state.mode,
        immersive: state.immersive,
        bindings: state.bindings,
        blockKeyboardSend: state.blockKeyboardSend,
      };
    }

    function commitSettings(next) {
      state.enabled = next.enabled !== false;
      state.mode = next.mode === MODE_MARKDOWN ? MODE_MARKDOWN : MODE_DEFAULT;
      state.immersive = next.immersive !== false;
      state.bindings = next.bindings;
      state.blockKeyboardSend = next.blockKeyboardSend === true;
      writeSettings(snapshot());
      settingsListeners.forEach((listener) => listener());
    }

    function setDraft(text) {
      if (state.draft === text) return;
      state.draft = text;
      draftListeners.forEach((listener) => listener());
    }

    /* ── 展示辅助 ─────────────────────────────────────────────────────── */

    function bindingKey(binding) {
      const parts = [];
      if (binding.ctrl) parts.push('control');
      if (binding.alt) parts.push('alt');
      if (binding.meta) parts.push('meta');
      if (binding.shift) parts.push('shift');
      parts.push(binding.code);
      return parts.join('+');
    }

    function sameBinding(a, b) {
      if (a === null || b === null) return false;
      return bindingKey(a) === bindingKey(b);
    }

    function codeLabel(code) {
      if (Object.prototype.hasOwnProperty.call(CODE_LABELS, code)) return CODE_LABELS[code];
      if (/^Key[A-Z]$/.test(code)) return code.slice(3);
      if (/^Digit[0-9]$/.test(code)) return code.slice(5);
      if (/^Numpad[0-9]$/.test(code)) return `Num ${code.slice(6)}`;
      return code;
    }

    function bindingLabel(binding) {
      if (binding === null || typeof binding !== 'object') return null;
      const parts = [];
      if (binding.ctrl) parts.push('Ctrl');
      if (binding.alt) parts.push(IS_MAC ? 'Option' : 'Alt');
      if (binding.shift) parts.push('Shift');
      if (binding.meta) parts.push(IS_MAC ? 'Cmd' : 'Win');
      parts.push(codeLabel(binding.code));
      return parts.join(' + ');
    }

    /* ── 输入框定位 ───────────────────────────────────────────────────── */

    function composerRoot(node) {
      const element =
        node instanceof Element
          ? node
          : node && node.parentElement instanceof Element
            ? node.parentElement
            : null;
      if (element !== null) {
        const root = element.closest('[data-composer-input]');
        if (root !== null) return root;
      }
      const active = document.activeElement;
      return active instanceof Element ? active.closest('[data-composer-input]') : null;
    }

    /**
     * 发送按钮带 aria-busy，停止按钮没有；React 会把布尔 false 渲染成 aria-busy="false"，
     * 所以这个选择器在发送按钮存在的任何时刻都成立，并且在同一张 composer 卡片里唯一。
     */
    function sendButtonFor(root) {
      const card = root.closest('[data-composer-card]');
      const scope = card !== null ? card : document;
      const direct = scope.querySelector('button[aria-busy]');
      if (direct !== null) return direct;
      // sending 取 undefined 时 React 会整条省略 aria-busy，用同源的 data-sending 兜底；
      // 两者都不在时退回卡片里最后一个可用按钮（正常情况下走不到这一步）。
      const sending = scope.querySelector('button[data-sending]');
      if (sending !== null) return sending;
      const buttons = scope.querySelectorAll('button');
      for (let index = buttons.length - 1; index >= 0; index -= 1) {
        const candidate = buttons[index];
        if (candidate.disabled !== true) return candidate;
      }
      return null;
    }

    /* ── 文本插入 ─────────────────────────────────────────────────────── */

    /**
     * 优先走 DSH 自己的 inputActions：
     *   captureInsertion() 给出带 draftRev 的插入点，insertText() 校验版本后
     *   交给编辑器执行，撤销栈、光标、文档模型全由 DSH 维护。
     * inputActions 不在（例如预览槽还没挂上）时退回 execCommand。
     */
    function insertIntoComposer(text) {
      const actions = state.actions;
      if (
        actions !== null &&
        typeof actions === 'object' &&
        typeof actions.captureInsertion === 'function' &&
        typeof actions.insertText === 'function'
      ) {
        try {
          const span = actions.captureInsertion();
          if (actions.insertText(text, span) === true) return true;
        } catch {
          /* 落到 execCommand。 */
        }
      }
      try {
        return document.execCommand('insertText', false, text) === true;
      } catch {
        return false;
      }
    }

    /**
     * 插入换行。
     *
     * composer 的 KEY_ENTER_COMMAND 处理器对 shiftKey === true 直接 return false，
     * 把控制权交回 Lexical 的默认处理，而那正是一条软换行。所以这里不去碰文档模型，
     * 只补发一次合成的 Shift+Enter——走的就是 Shift+Enter 原本那条原生路径，
     * 编辑器状态、撤销栈、光标位置全都由 DSH 自己维护。
     *
     * Lexical 不校验 isTrusted，合成事件与真实按键走完全相同的分支。
     */
    function insertLineBreak(root) {
      if (root.__lexicalEditor === undefined) {
        try {
          if (document.execCommand('insertLineBreak')) return;
        } catch {
          /* 部分环境禁用 execCommand，落到下面的兜底。 */
        }
      }
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
        composed: true,
      });
      state.synthetic = true;
      try {
        root.dispatchEvent(event);
      } finally {
        state.synthetic = false;
      }
    }

    /**
     * Markdown 续行：光标所在那一块（Lexical 的一段）以列表或引用标记开头时，
     * 换行后补上同样的标记。只用公开 DOM 接口——从选区往上爬到 root 的直接子块，
     * 读它的 textContent 就够判断前缀。
     */
    function markdownContinuation(root) {
      const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
      if (selection === null || selection.rangeCount === 0) return null;
      const range = selection.getRangeAt(0);
      let node = range.startContainer;
      if (node === null || node === root) return null;
      while (node !== null && node.parentNode !== root) node = node.parentNode;
      if (node === null) return null;
      const text = typeof node.textContent === 'string' ? node.textContent : '';
      if (text.trim() === '') return null;
      const match = /^(\s*)((?:[-*+] \[[ xX]\]|[-*+]|\d+\.|>))\s+/.exec(text);
      if (match === null) return null;
      // 空条目再回车就结束列表，不再续行。
      if (text.trim() === match[2]) return null;
      if (/^\d+\.$/.test(match[2])) return `${match[1]}${Number.parseInt(match[2], 10) + 1}. `;
      return `${match[1]}${match[2]} `;
    }

    /* ── 手势判定 ─────────────────────────────────────────────────────── */

    function isTypingGesture(event) {
      return event.isComposing === true || event.keyCode === 229;
    }

    function gestureFromEvent(event) {
      return {
        code: event.code,
        alt: event.altKey === true,
        ctrl: event.ctrlKey === true,
        meta: event.metaKey === true,
        shift: event.shiftKey === true,
      };
    }

    function matches(binding, event) {
      if (binding === null || typeof binding !== 'object') return false;
      return (
        event.code === binding.code &&
        event.altKey === binding.alt &&
        event.ctrlKey === binding.ctrl &&
        event.metaKey === binding.meta &&
        event.shiftKey === binding.shift
      );
    }

    function isEnterCode(code) {
      return code === 'Enter' || code === 'NumpadEnter';
    }

    /**
     * 斜杠命令与 @ 提及的菜单打开时，Enter 是用来选中候选的。
     * 那里必须原样放行，否则换行会顶掉一次选择。
     */
    function triggerMenuOpen() {
      return document.querySelector('[data-trigger-menu]') !== null;
    }

    /* ── Markdown 输入辅助 ────────────────────────────────────────────── */

    function primaryModifier(event) {
      return IS_MAC ? event.metaKey === true : event.ctrlKey === true;
    }

    function wrapSelection(marker) {
      const selection = typeof window.getSelection === 'function' ? window.getSelection() : null;
      const selected = selection === null ? '' : selection.toString();
      if (selected === '') return insertIntoComposer(`${marker}${marker}`);
      return insertIntoComposer(`${marker}${selected}${marker}`);
    }

    /**
     * Markdown 模式的按键。返回 true 表示已经接管这次按键。
     * 调用前已经确认：插件启用、焦点在输入框、菜单没打开。
     */
    function handleMarkdownKey(event, root) {
      if (event.code === 'Tab' && event.altKey !== true && event.ctrlKey !== true && event.metaKey !== true) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.shiftKey === true) return true;
        insertIntoComposer(TAB_TEXT);
        return true;
      }

      const plainPrimary =
        primaryModifier(event) && event.shiftKey !== true && event.altKey !== true;
      if (plainPrimary) {
        if (event.code === 'Digit1' || event.code === 'Digit2' || event.code === 'Digit3') {
          event.preventDefault();
          event.stopImmediatePropagation();
          const level = Number(event.code.slice(5));
          insertIntoComposer(`${'#'.repeat(level)} `);
          return true;
        }
        if (event.code === 'KeyB') {
          event.preventDefault();
          event.stopImmediatePropagation();
          wrapSelection('**');
          return true;
        }
        if (event.code === 'KeyI') {
          event.preventDefault();
          event.stopImmediatePropagation();
          wrapSelection('*');
          return true;
        }
        if (event.code === 'KeyE') {
          event.preventDefault();
          event.stopImmediatePropagation();
          wrapSelection('`');
          return true;
        }
      }

      const plainAlt = event.altKey === true && event.ctrlKey !== true && event.metaKey !== true && event.shiftKey !== true;
      if (plainAlt && Object.prototype.hasOwnProperty.call(MARKDOWN_ALT_INSERTS, event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        insertIntoComposer(MARKDOWN_ALT_INSERTS[event.code]);
        return true;
      }

      return false;
    }

    /* ── 捕获阶段接管 ─────────────────────────────────────────────────── */

    /**
     * 为什么必须是 window + capture：
     *
     * 1. Lexical 把 keydown 挂在 contenteditable 根节点（冒泡阶段），由它派发
     *    KEY_ENTER_COMMAND；composer 的处理器在那里 preventDefault 并 submit()。
     * 2. ShortcutsService 把 keydown 挂在 window 冒泡阶段，用来派发可配置命令。
     * 3. 命令表以命令对象的引用为键，插件伪造不出同一个引用，抢不到命令。
     *
     * window 捕获阶段早于上面两者。preventDefault 断掉浏览器默认行为，
     * stopImmediatePropagation 让事件再也到不了那两个监听器，于是不会有任何发送路径；
     * 需要换行时再自己补发一次合成 Shift+Enter。
     *
     * 默认模式下这个函数直接返回：一个字节都不拦，DSH 原生的
     * Enter 发送 / Shift + Enter 换行 / Ctrl + Cmd + Enter 发送原样保留。
     */
    function onKeyDownCapture(event) {
      if (state.suspended || state.synthetic) return;
      if (state.enabled !== true) return;
      // 只有 Markdown 模式才改键盘语义；默认模式必须和原版一模一样。
      if (state.mode !== MODE_MARKDOWN) return;
      if (event.defaultPrevented || isTypingGesture(event)) return;
      const root = composerRoot(event.target);
      if (root === null) return;
      if (triggerMenuOpen()) return;

      const bindings = state.bindings;

      if (matches(bindings.send, event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        const button = sendButtonFor(root);
        if (button !== null && button.disabled !== true) button.click();
        return;
      }

      if (matches(bindings.newline, event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        const continuation = markdownContinuation(root);
        insertLineBreak(root);
        if (continuation !== null) {
          // 换行是 Lexical 的异步更新，等它落定再补标记。
          window.setTimeout(() => insertIntoComposer(continuation), 0);
        }
        return;
      }

      if (handleMarkdownKey(event, root)) return;

      // 没有任何快捷键能发送时，带修饰键的 Enter 也拦下来换成换行，
      // 否则 Ctrl/Cmd/Alt + Enter 仍会走 DSH 的固定输入把消息发出去。
      if (state.blockKeyboardSend && isEnterCode(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        const continuation = markdownContinuation(root);
        insertLineBreak(root);
        if (continuation !== null) {
          window.setTimeout(() => insertIntoComposer(continuation), 0);
        }
      }
    }

    /* ── Markdown 渲染（只读预览） ────────────────────────────────────── */

    const INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\n]+\))/g;

    function safeHref(raw) {
      const value = typeof raw === 'string' ? raw.trim() : '';
      return /^https?:\/\//i.test(value) ? value : null;
    }

    function renderInline(text, keyBase) {
      if (typeof text !== 'string' || text === '') return [];
      const out = [];
      const pattern = new RegExp(INLINE_RE.source, 'g');
      let last = 0;
      let index = 0;
      let match = pattern.exec(text);
      while (match !== null) {
        if (match.index > last) out.push(text.slice(last, match.index));
        const token = match[0];
        const key = `${keyBase}-${index}`;
        index += 1;
        if (token.startsWith('**')) {
          out.push(h('strong', { key }, token.slice(2, -2)));
        } else if (token.startsWith('`')) {
          out.push(h('code', { key }, token.slice(1, -1)));
        } else if (token.startsWith('[')) {
          const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
          const href = link === null ? null : safeHref(link[2]);
          out.push(
            href === null
              ? token
              : h('a', { key, href, target: '_blank', rel: 'noreferrer' }, link[1]),
          );
        } else {
          out.push(h('em', { key }, token.slice(1, -1)));
        }
        last = match.index + token.length;
        match = pattern.exec(text);
      }
      if (last < text.length) out.push(text.slice(last));
      return out;
    }

    /** 极简 Markdown 渲染：标题、列表、引用、代码块、分隔线、段落 + 行内标记。 */
    function renderMarkdown(text, keyBase) {
      const lines = String(text).split('\n');
      const blocks = [];
      let list = null;
      let fence = null;

      const flushList = () => {
        if (list === null) return;
        const tag = list.ordered ? 'ol' : 'ul';
        blocks.push(
          h(
            tag,
            { key: `${keyBase}-l${blocks.length}` },
            list.items.map((item, itemIndex) =>
              h('li', { key: `${keyBase}-li${itemIndex}` }, renderInline(item, `${keyBase}-li${itemIndex}`)),
            ),
          ),
        );
        list = null;
      };

      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];

        if (fence !== null) {
          if (/^\s*```/.test(line)) {
            blocks.push(
              h(
                'pre',
                { key: `${keyBase}-p${blocks.length}` },
                h('code', null, fence.join('\n')),
              ),
            );
            fence = null;
          } else {
            fence.push(line);
          }
          continue;
        }

        if (/^\s*```/.test(line)) {
          flushList();
          fence = [];
          continue;
        }

        if (/^\s*$/.test(line)) {
          flushList();
          continue;
        }

        if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
          flushList();
          blocks.push(h('hr', { key: `${keyBase}-r${blocks.length}` }));
          continue;
        }

        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading !== null) {
          flushList();
          const level = heading[1].length;
          blocks.push(
            h(
              `h${level}`,
              { key: `${keyBase}-h${blocks.length}` },
              renderInline(heading[2], `${keyBase}-h${blocks.length}`),
            ),
          );
          continue;
        }

        const quote = /^\s*>\s?(.*)$/.exec(line);
        if (quote !== null) {
          flushList();
          blocks.push(
            h(
              'blockquote',
              { key: `${keyBase}-q${blocks.length}` },
              renderInline(quote[1], `${keyBase}-q${blocks.length}`),
            ),
          );
          continue;
        }

        const task = /^\s*[-*+]\s\[([ xX])\]\s+(.*)$/.exec(line);
        if (task !== null) {
          if (list === null || list.ordered) {
            flushList();
            list = { ordered: false, items: [] };
          }
          list.items.push(`${task[1].toLowerCase() === 'x' ? '☑ ' : '☐ '}${task[2]}`);
          continue;
        }

        const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
        if (bullet !== null) {
          if (list === null || list.ordered) {
            flushList();
            list = { ordered: false, items: [] };
          }
          list.items.push(bullet[1]);
          continue;
        }

        const ordered = /^\s*\d+\.\s+(.*)$/.exec(line);
        if (ordered !== null) {
          if (list === null || !list.ordered) {
            flushList();
            list = { ordered: true, items: [] };
          }
          list.items.push(ordered[1]);
          continue;
        }

        flushList();
        blocks.push(
          h(
            'p',
            { key: `${keyBase}-t${blocks.length}` },
            renderInline(line, `${keyBase}-t${blocks.length}`),
          ),
        );
      }

      if (fence !== null) {
        blocks.push(
          h('pre', { key: `${keyBase}-p${blocks.length}` }, h('code', null, fence.join('\n'))),
        );
      }
      flushList();
      return blocks;
    }

    /* ── 沉浸编辑窗（渲染面板） ───────────────────────────────────────── */

    /** apply() 里把 locale 的 t 绑到这里，组件才能拿到文案。 */
    let translate = (key) => key;

    function focusComposer() {
      if (typeof document === 'undefined') return;
      const root = document.querySelector('[data-composer-input]');
      if (root !== null && typeof root.focus === 'function') root.focus();
    }

    function setImmersive(next) {
      const current = snapshot();
      commitSettings({
        enabled: current.enabled,
        mode: current.mode,
        immersive: next,
        bindings: current.bindings,
        blockKeyboardSend: current.blockKeyboardSend,
      });
    }

    /**
     * 这个面板挂在 conversation.input.overlay 上，渲染进 composer 卡片内部的
     * div[data-composer-overlay]。卡片自己是 position: relative，所以面板只要
     * 绝对定位就能严丝合缝地贴在卡片右侧，而不是在输入框下面另起一块。
     *
     * 左侧仍然是 DSH 原来那个 contenteditable（光标、撤销、斜杠命令、@ 提及
     * 全都还在），右侧是它的实时渲染结果——同一份文本，两种视图。
     */
    function ComposerStudioImmersive(props) {
      const actions = props === undefined ? null : props.inputActions;
      if (actions !== undefined && actions !== null) state.actions = actions;

      const [draft, setDraftText] = useState(state.draft);
      const [settings, setSettingsView] = useState(snapshot);
      const [view, setView] = useState('split');

      useEffect(() => {
        const offDraft = onDraftChange(() => setDraftText(state.draft));
        const offSettings = onSettingsChange(() => setSettingsView(snapshot()));
        setDraftText(state.draft);
        setSettingsView(snapshot());
        return () => {
          offDraft();
          offSettings();
        };
      }, []);

      const active =
        settings.enabled === true && settings.mode === MODE_MARKDOWN && settings.immersive === true;

      // 卡片放大、编辑区收窄，全靠 body 上的这两个 class。
      useEffect(() => {
        if (typeof document === 'undefined') return undefined;
        const body = document.body;
        body.classList.toggle(IMMERSIVE_CLASS, active);
        body.classList.toggle('dcs-source', active && view === 'source');
        return () => {
          body.classList.remove(IMMERSIVE_CLASS);
          body.classList.remove('dcs-source');
        };
      }, [active, view]);

      if (!active) return null;

      const t = translate;
      const text = typeof draft === 'string' ? draft : '';
      const empty = text.trim() === '';

      return h(
        'div',
        {
          className: 'dcs-pane',
          'data-composer-immersive': 'true',
          'data-view': view === 'source' ? 'source' : 'split',
        },
        h(
          'div',
          { className: 'dcs-head' },
          h('span', { className: 'dcs-title' }, 'Markdown'),
          h(
            'div',
            { className: 'dcs-tools' },
            h('span', { className: 'dcs-count' }, `${text.length}`),
            h(
              'button',
              {
                type: 'button',
                className: 'dcs-tab',
                'data-active': view === 'split' ? 'true' : 'false',
                onClick: () => setView('split'),
              },
              t('viewRendered'),
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dcs-tab',
                'data-active': view === 'source' ? 'true' : 'false',
                onClick: () => setView('source'),
              },
              t('viewSource'),
            ),
            h(
              'button',
              { type: 'button', className: 'dcs-tab', onClick: () => setImmersive(false) },
              t('immersiveExit'),
            ),
          ),
        ),
        h(
          'div',
          { className: 'dcs-body', onClick: focusComposer },
          empty
            ? h('p', { className: 'dcs-empty' }, t('immersiveEmpty'))
            : h('div', { className: 'dcs-md' }, renderMarkdown(text, 'dcs')),
        ),
      );
    }

    /* ── 设置面板 ─────────────────────────────────────────────────────── */

    function KeyRow(props) {
      const { t, title, desc, binding, emptyLabel, recording, onRecord, onClear, onCancel } = props;
      const label = recording ? t('recording') : (bindingLabel(binding) || emptyLabel);
      return h(
        'div',
        { className: 'dck-row' },
        h('div', { className: 'dck-text' }, h('strong', null, title), h('span', null, desc)),
        h(
          'div',
          { className: 'dck-actions' },
          h(
            'span',
            {
              className: 'dck-chip',
              'data-recording': recording ? 'true' : 'false',
              'data-empty': !recording && binding === null ? 'true' : 'false',
            },
            label,
          ),
          binding !== null && !recording
            ? h('button', { type: 'button', className: 'dck-button', onClick: onClear }, t('clear'))
            : null,
          h(
            'button',
            { type: 'button', className: 'dck-button', onClick: recording ? onCancel : onRecord },
            recording ? t('cancel') : t('record'),
          ),
        ),
      );
    }

    function SwitchRow(props) {
      const { title, desc, checked, onChange } = props;
      return h(
        'div',
        { className: 'dck-row' },
        h('div', { className: 'dck-text' }, h('strong', null, title), h('span', null, desc)),
        h(
          'label',
          { className: 'dck-switch' },
          h('input', { type: 'checkbox', checked, onChange: (event) => onChange(event.target.checked) }),
        ),
      );
    }

    function MarkdownKeyTable(props) {
      const { t } = props;
      const rows = [
        [t('mdTab'), t('mdTabDesc')],
        [t('mdHeadings'), t('mdHeadingsDesc')],
        [t('mdLists'), t('mdListsDesc')],
        [t('mdTasks'), t('mdTasksDesc')],
        [t('mdBlocks'), t('mdBlocksDesc')],
        [t('mdInline'), t('mdInlineDesc')],
        [t('mdContinue'), t('mdContinueDesc')],
      ];
      return h(
        'div',
        { className: 'dck-kv' },
        rows.map((row, index) =>
          h(Fragment, { key: `mdrow-${index}` }, h('code', null, row[0]), h('span', null, row[1])),
        ),
      );
    }

    function ComposerStudioSection({ t }) {
      const [settings, setSettings] = useState(snapshot);
      const [recording, setRecording] = useState(null);
      const [error, setError] = useState('');
      const live = useRef(settings);
      live.current = settings;

      useEffect(() => onSettingsChange(() => setSettings(snapshot())), []);

      const save = useCallback((next) => {
        live.current = next;
        commitSettings(next);
        setSettings(snapshot());
      }, []);

      const reset = useCallback(() => {
        setError('');
        setRecording(null);
        save(defaults());
      }, [save]);

      const setBinding = useCallback(
        (action, binding) => {
          setError('');
          const current = live.current;
          save({
            enabled: current.enabled,
            mode: current.mode,
            immersive: current.immersive,
            bindings: { ...current.bindings, [action]: binding },
            blockKeyboardSend: current.blockKeyboardSend,
          });
        },
        [save],
      );

      useEffect(() => {
        if (recording === null) return undefined;
        // 录制期间让主监听器闭嘴，否则它会把这次按键当成换行/发送吃掉。
        state.suspended = true;
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopImmediatePropagation();
            setRecording(null);
            return;
          }
          if (MODIFIER_KEYS.includes(event.key)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const pressed = gestureFromEvent(event);
          const other = recording === 'send' ? 'newline' : 'send';
          if (sameBinding(pressed, live.current.bindings[other])) {
            setError(t('duplicate'));
            return;
          }
          setError('');
          setRecording(null);
          setBinding(recording, pressed);
        };
        window.addEventListener('keydown', onKey, true);
        return () => {
          state.suspended = false;
          window.removeEventListener('keydown', onKey, true);
        };
      }, [recording, setBinding, t]);

      const enabled = settings.enabled;

      return h(
        'div',
        { className: 'dck-section' },
        h('p', { className: 'dck-intro' }, t('intro')),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardMaster')),
          h(SwitchRow, {
            title: t('masterTitle'),
            desc: t('masterDesc'),
            checked: enabled,
            onChange: (checked) =>
              save({
                enabled: checked,
                mode: live.current.mode,
                immersive: live.current.immersive,
                bindings: live.current.bindings,
                blockKeyboardSend: live.current.blockKeyboardSend,
              }),
          }),
        ),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardMode')),
          h(
            'div',
            { className: 'dck-row' },
            h(
              'div',
              { className: 'dck-text' },
              h('strong', null, t('cardMode')),
              h('span', null, settings.mode === MODE_MARKDOWN ? t('modeMarkdownDesc') : t('modeDefaultDesc')),
            ),
            h(
              'div',
              { className: 'dck-seg' },
              h(
                'button',
                {
                  type: 'button',
                  'data-active': settings.mode === MODE_DEFAULT ? 'true' : 'false',
                  disabled: !enabled,
                  onClick: () =>
                    save({
                      enabled: live.current.enabled,
                      mode: MODE_DEFAULT,
                      immersive: live.current.immersive,
                      bindings: live.current.bindings,
                      blockKeyboardSend: live.current.blockKeyboardSend,
                    }),
                },
                t('modeDefault'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-active': settings.mode === MODE_MARKDOWN ? 'true' : 'false',
                  disabled: !enabled,
                  onClick: () =>
                    save({
                      enabled: live.current.enabled,
                      mode: MODE_MARKDOWN,
                      immersive: live.current.immersive,
                      bindings: live.current.bindings,
                      blockKeyboardSend: live.current.blockKeyboardSend,
                    }),
                },
                t('modeMarkdown'),
              ),
            ),
          ),
        ),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardKeys')),
          h(KeyRow, {
            t,
            title: t('sendTitle'),
            desc: t('sendDesc'),
            binding: settings.bindings.send,
            emptyLabel: t('sendClickOnly'),
            recording: recording === 'send',
            onRecord: () => {
              setError('');
              setRecording('send');
            },
            onClear: () => setBinding('send', null),
            onCancel: () => setRecording(null),
          }),
          h(KeyRow, {
            t,
            title: t('newlineTitle'),
            desc: t('newlineDesc'),
            binding: settings.bindings.newline,
            emptyLabel: t('newlineClickOnly'),
            recording: recording === 'newline',
            onRecord: () => {
              setError('');
              setRecording('newline');
            },
            onClear: () => setBinding('newline', null),
            onCancel: () => setRecording(null),
          }),
        ),
        error === '' ? null : h('p', { className: 'dck-error' }, error),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardBehaviour')),
          h(SwitchRow, {
            title: t('blockTitle'),
            desc: t('blockDesc'),
            checked: settings.blockKeyboardSend,
            onChange: (checked) =>
              save({
                enabled: live.current.enabled,
                mode: live.current.mode,
                immersive: live.current.immersive,
                bindings: live.current.bindings,
                blockKeyboardSend: checked,
              }),
          }),
        ),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardMdKeys')),
          h('p', { className: 'dck-note' }, t('mdKeysIntro')),
          h(MarkdownKeyTable, { t }),
        ),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardImmersive')),
          h(SwitchRow, {
            title: t('immersiveTitle'),
            desc: t('immersiveDesc'),
            checked: settings.immersive,
            onChange: (checked) =>
              save({
                enabled: live.current.enabled,
                mode: live.current.mode,
                immersive: checked,
                bindings: live.current.bindings,
                blockKeyboardSend: live.current.blockKeyboardSend,
              }),
          }),
          h('div', { className: 'dck-row' }, h('div', { className: 'dck-text' }, h('span', null, t('immersiveNote')))),
        ),

        h(
          'div',
          { className: 'dck-foot' },
          h('p', { className: 'dck-note' }, t('resetHint')),
          h('button', { type: 'button', className: 'dck-button', onClick: reset }, t('reset')),
        ),

        h(
          'div',
          { className: 'dck-card' },
          h('div', { className: 'dck-card-title' }, t('cardMore')),
          h('div', { className: 'dck-row' }, h('div', { className: 'dck-text' }, h('span', null, t('moreHint')))),
        ),
      );
    }

    /* ── 插件入口 ─────────────────────────────────────────────────────── */

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ensureStyles(), 'composer-studio: styles');

        ctx.effect(() => {
          window.addEventListener('keydown', onKeyDownCapture, true);
          return () => window.removeEventListener('keydown', onKeyDownCapture, true);
        }, 'composer-studio: composer key capture');

        // 记下草稿文本，预览与 Markdown 辅助都靠它。
        ctx.effect(() => {
          const onInput = (event) => {
            const root = composerRoot(event.target);
            if (root === null) return;
            const text = typeof root.innerText === 'string' && root.innerText !== '' ? root.innerText : root.textContent;
            setDraft(typeof text === 'string' ? text : '');
          };
          window.addEventListener('input', onInput, true);
          return () => window.removeEventListener('input', onInput, true);
        }, 'composer-studio: draft capture');

        // 另一个标签页改了设置，这里同步跟上，避免两个窗口行为不一致。
        ctx.effect(() => {
          const onStorage = (event) => {
            if (event.key !== STORAGE_KEY || state.suspended) return;
            const next = readSettings();
            state.enabled = next.enabled;
            state.mode = next.mode;
            state.immersive = next.immersive;
            state.bindings = next.bindings;
            state.blockKeyboardSend = next.blockKeyboardSend;
            settingsListeners.forEach((listener) => listener());
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        }, 'composer-studio: cross-tab sync');

        ctx.effect(() => ctx.locale.register(NS, DICT), 'composer-studio: dictionaries');

        const t = ctx.locale.bind(NS);
        translate = t;

        // 方便在 DevTools 里核对当前生效状态。
        if (typeof window !== 'undefined') {
          window.__dshComposerStudio = {
            state,
            snapshot,
            defaults,
            version: 3,
          };
        }

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: SECTION_ID,
              order: 14,
              label: () => t('nav'),
              locale: NS,
              inject: () => ({ t }),
            },
            ComposerStudioSection,
          ),
        );

        ctx.slots.inject(OVERLAY_SLOT, () =>
          ctx.slots.register(
            {
              name: OVERLAY_SLOT,
              id: OVERLAY_ID,
              order: 20,
            },
            ComposerStudioImmersive,
          ),
        );
      },
    };
  },
});
