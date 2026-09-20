// Groups join-table rows (e.g. event_rsvps) into a Map keyed by the parent
// id, used when reassembling a DB row back into an app type that expects a
// plain array (Event.rsvps, Circle.members, ...).
export function groupBy<T, K, V>(rows: T[], key: (row: T) => K, value: (row: T) => V): Map<K, V[]> {
  const map = new Map<K, V[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(value(row));
    else map.set(k, [value(row)]);
  }
  return map;
}
