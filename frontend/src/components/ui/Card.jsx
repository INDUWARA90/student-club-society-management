import { Link } from 'react-router-dom'

/** Shared surface card. Renders a Link when `to` is given, else a div (or `as` override). */
function Card({ to, interactive = Boolean(to), as: As = 'div', className = '', children, ...rest }) {
  const base = 'rounded-xl border border-border bg-surface p-4 shadow-card dark:border-border-dark dark:bg-surface-dark-muted'
  const hover = interactive ? 'transition-base hover:-translate-y-0.5 hover:shadow-card-hover' : ''

  if (to) {
    return (
      <Link to={to} className={`${base} ${hover} ${className}`} {...rest}>
        {children}
      </Link>
    )
  }

  return (
    <As className={`${base} ${hover} ${className}`} {...rest}>
      {children}
    </As>
  )
}

export default Card
