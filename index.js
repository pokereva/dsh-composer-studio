/**
 * Host half of @local/dsh-composer-keys.
 *
 * Everything this plugin does happens in the browser: a capture-phase keydown
 * listener rewrites the composer's Enter gestures, and a Settings section lets
 * the user remap both of them. The host half therefore only has to exist so the
 * bundle patch can mount it.
 */
export function apply() {}
