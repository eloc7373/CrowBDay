let counter = 0

/** Short unique id, e.g. "prop_lx2k9a_3f". Unique within a session and across reloads. */
export function newId(prefix = 'id'): string {
  counter = (counter + 1) % 1296
  const time = Date.now().toString(36)
  const rand = Math.floor(Math.random() * 46656).toString(36)
  return `${prefix}_${time}${rand}${counter.toString(36)}`
}
