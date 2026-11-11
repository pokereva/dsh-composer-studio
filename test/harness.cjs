/**
 * 离线行为测试：把 client.js 装进一个最小 DOM 替身里，验证捕获阶段的分支。
 * 只测本插件自己的逻辑，不测 DSH。
 *
 * 运行：node test/harness.cjs
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert');

/* ── 最小 DOM 替身 ─────────────────────────────────────────────────── */

class FakeElement {
  constructor(tag, attrs) {
    this.tagName = (tag || 'div').toUpperCase();
    this.attributes = { ...(attrs || {}) };
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.disabled = false;
    this.clicks = 0;
    this.dispatched = [];
    this.textContent = '';
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  closest(selector) {
    let node = this;
    while (node !== null && node !== undefined) {
      if (matchesSelector(node, selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) return child;
      const nested = child.querySelector(selector);
      if (nested !== null) return nested;
    }
    return null;
  }

  click() {
    this.clicks += 1;
  }

  dispatchEvent(event) {
    this.dispatched.push(event);
    return true;
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    const parent = this.parentElement;
    if (parent === null) return;
    const index = parent.children.indexOf(this);
    if (index >= 0) parent.children.splice(index, 1);
    this.parentElement = null;
  }
}

/** 只支持测试用到的选择器形态。 */
function matchesSelector(node, selector) {
  if (!(node instanceof FakeElement)) return false;
  const trimmed = selector.trim();
  const attrOnly = /^\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(trimmed);
  if (attrOnly !== null) {
    const name = attrOnly[1];
    const expected = attrOnly[2];
    if (!Object.prototype.hasOwnProperty.call(node.attributes, name)) return false;
    return expected === undefined || String(node.attributes[name]) === expected;
  }
  const compound = /^([a-zA-Z]*)\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(trimmed);
  if (compound !== null) {
    const [, tag, name, expected] = compound;
    if (tag !== '' && node.tagName !== tag.toUpperCase()) return false;
    if (!Object.prototype.hasOwnProperty.call(node.attributes, name)) return false;
    return expected === undefined || String(node.attributes[name]) === expected;
  }
  if (/^[a-zA-Z]+$/.test(trimmed)) return node.tagName === trimmed.toUpperCase();
  return false;
}

class FakeKeyboardEvent {
  constructor(type, init) {
    const data = init || {};
    this.type = type;
    this.key = data.key;
    this.code = data.code;
    this.shiftKey = data.shiftKey === true;
    this.ctrlKey = data.ctrlKey === true;
    this.altKey = data.altKey === true;
    this.metaKey = data.metaKey === true;
    this.repeat = data.repeat === true;
    this.isComposing = data.isComposing === true;
    this.keyCode = data.keyCode === undefined ? 0 : data.keyCode;
    this.bubbles = data.bubbles === true;
    this.cancelable = data.cancelable === true;
    this.composed = data.composed === true;
    this.target = data.target === undefined ? null : data.target;
    this.defaultPrevented = false;
    this.immediateStopped = false;
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
  stopImmediatePropagation() {
    this.immediateStopped = true;
  }
  getModifierState() {
    return false;
  }
}

const reactStub = {
  createElement: () => null,
  useCallback: (fn) => fn,
  useEffect: () => {},
  useRef: (value) => ({ current: value }),
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
};

const CLIENT_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');

/* ── 环境装配 ─────────────────────────────────────────────────────── */

function createEnv(options) {
  const opts = options || {};
  const windowListeners = new Map();

  const documentStub = {
    head: new FakeElement('head'),
    body: new FakeElement('body'),
    activeElement: null,
    createElement: (tag) => new FakeElement(tag),
    querySelector: (selector) => {
      if (!opts.root) return null;
      if (matchesSelector(opts.root, selector)) return opts.root;
      return opts.root.querySelector(selector);
    },
    addEventListener() {},
    removeEventListener() {},
  };

  const storage = new Map();
  if (opts.storage) {
    for (const [key, value] of Object.entries(opts.storage)) storage.set(key, value);
  }

  const windowStub = {
    addEventListener(type, listener) {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const list = windowListeners.get(type);
      if (list === undefined) return;
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    },
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  };

  let loaded = null;
  windowStub.__ModuleLoader__ = {
    load(definition) {
      loaded = definition;
    },
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    Element: FakeElement,
    KeyboardEvent: FakeKeyboardEvent,
    console,
  };

  vm.runInNewContext(CLIENT_SOURCE, sandbox, { filename: 'client.js' });
  assert.ok(loaded !== null, 'client.js 必须调用 window.__ModuleLoader__.load');

  return {
    windowListeners,
    document: documentStub,
    window: windowStub,
    storage,
    getApply: () => loaded.factory((name) => {
      if (name === 'react') return reactStub;
      throw new Error(`unexpected require: ${name}`);
    }),
  };
}

function installPlugin(env) {
  const plugin = env.getApply();
  const effects = [];
  const slots = [];

  const ctx = {
    effect(factory, label) {
      const dispose = factory();
      effects.push({ label, dispose });
      return dispose;
    },
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    slots: {
      inject(name, factory) {
        slots.push({ name, factory });
      },
      register(definition) {
        return { definition };
      },
    },
  };

  plugin.apply(ctx);
  return { plugin, effects, slots };
}

function keydown(env, init) {
  const listener = env.windowListeners.get('keydown')?.[0];
  assert.ok(listener, 'window keydown listener must be registered during apply');
  const event = new FakeKeyboardEvent('keydown', init);
  listener(event);
  return event;
}

function createComposer() {
  const card = new FakeElement('div', { 'data-composer-card': 'true' });
  const input = new FakeElement('div', { 'data-composer-input': 'true' });
  const send = new FakeElement('button', { 'aria-busy': 'false' });
  const stop = new FakeElement('button', { 'aria-label': 'stop' });
  card.appendChild(input);
  card.appendChild(send);
  card.appendChild(stop);
  input.__lexicalEditor = {};
  return { card, input, send, stop };
}

/* ── 断言 ─────────────────────────────────────────────────────────── */

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}

check('裸 Enter 在输入框里换行，不触发发送', () => {
  const composer = createComposer();
  const env = createEnv({ root: composer.card });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', target: composer.input });
  assert.strictEqual(event.defaultPrevented, true, 'Enter 的默认行为必须被挡住');
  assert.strictEqual(event.immediateStopped, true, 'Enter 不能再传到 Lexical / shortcuts');
  assert.strictEqual(composer.send.clicks, 0, '不允许任何键盘发送');
  assert.strictEqual(composer.input.dispatched.length, 1, '必须补发一次合成 Shift+Enter');
  const synthetic = composer.input.dispatched[0];
  assert.strictEqual(synthetic.shiftKey, true, '合成事件必须是 Shift+Enter');
  assert.strictEqual(synthetic.key, 'Enter');
});

check('Shift + Enter 同样不发送，退化为换行', () => {
  const composer = createComposer();
  const env = createEnv({ root: composer.card });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', shiftKey: true, target: composer.input });
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(composer.send.clicks, 0);
  assert.strictEqual(composer.input.dispatched.length, 1);
});

check('Ctrl + Enter 也不会把消息发出去', () => {
  const composer = createComposer();
  const env = createEnv({ root: composer.card });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', ctrlKey: true, target: composer.input });
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(composer.send.clicks, 0);
});

check('trigger 菜单打开时不接管 Enter', () => {
  const composer = createComposer();
  const menu = new FakeElement('div', { 'data-trigger-menu': '' });
  const env = createEnv({ root: menu });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', bubbles: true, target: composer.input });
  assert.strictEqual(event.defaultPrevented, false, '菜单里的 Enter 是选中候选，必须原样放行');
  assert.strictEqual(composer.input.dispatched.length, 0);
});

check('输入框之外的 Enter 不受影响', () => {
  const composer = createComposer();
  const env = createEnv({ root: null });
  installPlugin(env);
  const outside = new FakeElement('div');
  env.document.activeElement = outside;
  const event = keydown(env, { key: 'Enter', code: 'Enter', bubbles: true, target: outside });
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(composer.input.dispatched.length, 0);
});

check('输入法组合期间的 Enter 不接管', () => {
  const composer = createComposer();
  const env = createEnv({ root: composer.card });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', isComposing: true, target: composer.input });
  assert.strictEqual(event.defaultPrevented, false);
  assert.strictEqual(composer.input.dispatched.length, 0);
});

check('长按 Enter 只在第一次换行', () => {
  const composer = createComposer();
  const env = createEnv({ root: composer.card });
  installPlugin(env);
  keydown(env, { key: 'Enter', code: 'Enter', target: composer.input });
  keydown(env, { key: 'Enter', code: 'Enter', repeat: true, target: composer.input });
  assert.strictEqual(composer.input.dispatched.length, 1);
});

check('把发送重新绑到 Ctrl + Enter 后，该组合会点击发送按钮', () => {
  const composer = createComposer();
  const stored = JSON.stringify({
    bindings: {
      newline: { code: 'Enter', alt: false, ctrl: false, meta: false, shift: false },
      send: { code: 'Enter', alt: false, ctrl: true, meta: false, shift: false },
    },
    blockKeyboardSend: false,
  });
  const env = createEnv({ root: composer.card, storage: { 'dsh.composer-keys.v1': stored } });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', ctrlKey: true, target: composer.input });
  assert.strictEqual(event.defaultPrevented, true);
  assert.strictEqual(composer.send.clicks, 1, '自定义的发送键必须真的点按钮');
});

check('关掉「拦截所有键盘发送」后 Ctrl + Enter 不再被改写成换行', () => {
  const composer = createComposer();
  const stored = JSON.stringify({
    bindings: {
      newline: { code: 'Enter', alt: false, ctrl: false, meta: false, shift: false },
      send: null,
    },
    blockKeyboardSend: false,
  });
  const env = createEnv({ root: composer.card, storage: { 'dsh.composer-keys.v1': stored } });
  installPlugin(env);
  const event = keydown(env, { key: 'Enter', code: 'Enter', ctrlKey: true, target: composer.input });
  assert.strictEqual(event.defaultPrevented, false, '关掉后应当放行给 DSH 原来的处理');
});

check('注册 settings.section 槽位', () => {
  const env = createEnv({ root: null });
  const instance = installPlugin(env);
  assert.strictEqual(instance.slots.length, 1);
  assert.strictEqual(instance.slots[0].name, 'settings.section');
});

check('apply 注册了 window 捕获监听与样式', () => {
  const env = createEnv({ root: null });
  const instance = installPlugin(env);
  assert.strictEqual(env.windowListeners.get('keydown')?.length, 1);
  assert.ok(instance.effects.length >= 4, '样式、监听、跨标签同步、字典都应走 ctx.effect');
  assert.strictEqual(
    env.document.head.children.filter((node) => node.dataset.pluginCss !== undefined).length,
    1,
    '样式只注入一次',
  );
});

/* ── 输出 ─────────────────────────────────────────────────────────── */

let failed = 0;
for (const result of results) {
  if (result.ok) {
    console.log(`  ok   ${result.name}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${result.name}`);
    console.log(`       ${result.error.message}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed === 0 ? 0 : 1);
