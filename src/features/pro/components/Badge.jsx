import { PROJECT_STATUS } from '../constants'

export default function Badge({ status, map = PROJECT_STATUS }) {
  const s = map[status] ?? { label: status ?? '—', cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
}
