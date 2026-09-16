import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-ink-muted dark:text-ink-dark-muted" />}
            {isLast || !item.to ? (
              <span className="text-ink-muted dark:text-ink-dark-muted">{item.label}</span>
            ) : (
              <Link to={item.to} className="text-brand-600 hover:underline">
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default Breadcrumbs
