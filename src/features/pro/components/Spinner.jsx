export default function Spinner({ small }) {
  return <span className={`inline-block border-2 border-current border-t-transparent rounded-full animate-spin ${small ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
}
