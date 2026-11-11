/**
 * Host half of @local/dsh-composer-studio.
 *
 * Everything this plugin does happens in the browser: a capture-phase keydown
 * listener rewrites the composer's Enter gestures, an optional Markdown mode
 * adds input helpers and a live preview, and a Settings section owns the master
 * switch plus the key bindings. The host half therefore only has to exist so
 * the bundle patch can mount it.
 */
export function apply() {}
