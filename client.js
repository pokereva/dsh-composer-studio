window.__ModuleLoader__.load({
  id: '@local/dsh-composer-keys',
  factory(require) {
    const { createElement: h, useCallback, useEffect, useRef, useState } = require('react');

    /* ── 常量 ─────────────────────────────────────────────────────────── */

    const NS = 'composerKeys';
    const STORAGE_KEY = 'dsh.composer-keys.v1';
    const STYLE_ID = '@local/dsh-composer-keys/section.css';
    const SECTION_ID = 'composer-keys';

    /**
     * 默认值就是需求本身：
     *   - 发送：null —— 没有键盘发送，只能点发送按钮
     *   - 换行：Enter —— 裸 Enter 在光标处换行
     * 于是输入框就是一个真正的多行文本框。
     */
    const DEFAULT_BINDINGS = {
      newline: { code: 'Enter', alt: false, ctrl: false, meta: false, shift: false },
      send: null,
    };

    const DEFAULT_BLOCK_KEYBOARD_SEND = true;

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

    const DICT = {
      zh: {
        nav: '输入框快捷键',
        cardKeys: '按键映射',
        intro:
          'DSH 把 Enter 固定为「发送」、Shift + Enter 固定为「换行」，两者都不允许改。这个插件在捕获阶段接管这两个手势，让 Enter 变成换行、发送只能靠点击，也可以把它们录制成任意组合键。',
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
        resetHint: '默认：Enter 换行，发送只能点击。',
        duplicate: '这两个动作不能使用同一个组合键。',
        cardBehaviour: '行为',
        blockTitle: '屏蔽所有键盘发送',
        blockDesc: '连 Ctrl + Enter、Cmd + Enter 也不发送，一律换成插入换行。',
        cardMore: '其他快捷键',
        moreHint:
          '其余快捷键在「设置 → 通用 → 快捷键」里改。那里列出的 Enter、Shift + Enter、Ctrl + Enter 属于固定输入，只在这里才能调整。',
      },
      en: {
        nav: 'Composer keys',
        cardKeys: 'Key bindings',
        intro:
          'DSH hard-codes Enter as send and Shift + Enter as newline, and neither can be remapped. This plugin claims both gestures during the capture phase, so Enter inserts a line break, sending happens by click, and either can be recorded as any combination.',
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
        resetHint: 'Defaults: Enter inserts a line break, sending is click-only.',
        duplicate: 'The two actions cannot share one combination.',
        cardBehaviour: 'Behaviour',
        blockTitle: 'Block every keyboard send',
        blockDesc: 'Ctrl + Enter and Cmd + Enter also insert a line break instead of sending.',
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
.dck-foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.dck-note { margin: 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; line-height: 1.6; }
.dck-error { margin: 0; color: var(--dsw-alias-state-error-primary, #d92d20); font-size: 12px; }
.dck-switch { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px; }
.dck-switch input { width: 15px; height: 15px; margin: 0; accent-color: var(--dsw-alias-brand-primary, #247bbf); cursor: pointer; }
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

    /* ── 绑定读写 ─────────────────────────────────────────────────────── */

    function normalizeBinding(value, fallback) {
      if (value === null) return null;
      if (typeof value !== 'object' || typeof value.code !== 'string' || value.code === '') {
        return fallback === undefined ? null : fallback === null ? null : { ...fallback };
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
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
          return {
            bindings: { newline: { ...DEFAULT_BINDINGS.newline }, send: null },
            blockKeyboardSend: DEFAULT_BLOCK_KEYBOARD_SEND,
          };
        }
        const parsed = JSON.parse(raw);
        const bindings = parsed && typeof parsed === 'object' ? parsed.bindings || parsed : {};
        return {
          bindings: {
            newline: normalizeBinding(bindings.newline, DEFAULT_BINDINGS.newline),
            send: normalizeBinding(bindings.send, null),
          },
          blockKeyboardSend:
            typeof parsed?.blockKeyboardSend === 'boolean'
              ? parsed.blockKeyboardSend
              : DEFAULT_BLOCK_KEYBOARD_SEND,
        };
      } catch {
        return {
          bindings: { newline: { ...DEFAULT_BINDINGS.newline }, send: null },
          blockKeyboardSend: DEFAULT_BLOCK_KEYBOARD_SEND,
        };
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
    const state = { ...readSettings(), suspended: false, synthetic: false };

    function commitSettings(next) {
      state.bindings = next.bindings;
      state.blockKeyboardSend = next.blockKeyboardSend;
      writeSettings(next);
    }

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

    /* ── 输入框操作 ───────────────────────────────────────────────────── */

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
     */
    function onKeyDownCapture(event) {
      if (state.suspended || state.synthetic) return;
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
        insertLineBreak(root);
        return;
      }

      // 没有任何快捷键能发送时，带修饰键的 Enter 也拦下来换成换行，
      // 否则 Ctrl/Cmd/Alt + Enter 仍会走 DSH 的固定输入把消息发出去。
      if (state.blockKeyboardSend && isEnterCode(event.code)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.repeat) return;
        insertLineBreak(root);
      }
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

    function ComposerKeysSection({ t }) {
      const [settings, setSettings] = useState(() => ({
        bindings: state.bindings,
        blockKeyboardSend: state.blockKeyboardSend,
      }));
      const [recording, setRecording] = useState(null);
      const [error, setError] = useState('');
      const live = useRef(settings);
      live.current = settings;

      const save = useCallback((next) => {
        live.current = next;
        commitSettings(next);
        setSettings(next);
      }, []);

      const reset = useCallback(() => {
        setError('');
        setRecording(null);
        save({
          bindings: { newline: { ...DEFAULT_BINDINGS.newline }, send: null },
          blockKeyboardSend: DEFAULT_BLOCK_KEYBOARD_SEND,
        });
      }, [save]);

      const setBinding = useCallback(
        (action, binding) => {
          setError('');
          const current = live.current;
          const next = {
            bindings: { ...current.bindings, [action]: binding },
            blockKeyboardSend: current.blockKeyboardSend,
          };
          save(next);
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

      return h(
        'div',
        { className: 'dck-section' },
        h('p', { className: 'dck-intro' }, t('intro')),
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
          h(
            'div',
            { className: 'dck-row' },
            h(
              'label',
              { className: 'dck-text' },
              h('strong', null, t('blockTitle')),
              h('span', null, t('blockDesc')),
            ),
            h(
              'label',
              { className: 'dck-switch' },
              h('input', {
                type: 'checkbox',
                checked: settings.blockKeyboardSend,
                onChange: (event) =>
                  save({
                    bindings: live.current.bindings,
                    blockKeyboardSend: event.target.checked,
                  }),
              }),
            ),
          ),
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
        ctx.effect(() => ensureStyles(), 'composer-keys: settings styles');

        ctx.effect(() => {
          window.addEventListener('keydown', onKeyDownCapture, true);
          return () => window.removeEventListener('keydown', onKeyDownCapture, true);
        }, 'composer-keys: composer key capture');

        // 另一个标签页改了设置，这里同步跟上，避免两个窗口行为不一致。
        ctx.effect(() => {
          const onStorage = (event) => {
            if (event.key !== STORAGE_KEY || state.suspended) return;
            const next = readSettings();
            state.bindings = next.bindings;
            state.blockKeyboardSend = next.blockKeyboardSend;
          };
          window.addEventListener('storage', onStorage);
          return () => window.removeEventListener('storage', onStorage);
        }, 'composer-keys: cross-tab sync');

        ctx.effect(() => ctx.locale.register(NS, DICT), 'composer-keys: dictionaries');

        const t = ctx.locale.bind(NS);

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
            ComposerKeysSection,
          ),
        );
      },
    };
  },
});
