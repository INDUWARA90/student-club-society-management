import { BarChart3, Table2 } from 'lucide-react'
import { useState } from 'react'
import Card from '../ui/Card'

/** Legend row: a swatch per series. Shown for two or more series; a single series is named by the title. */
function Legend({ items }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-muted dark:text-ink-dark-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Card shell shared by every chart: title, optional legend, and a table view that carries the same
 * numbers as the plot so nothing is reachable only through hover or colour.
 * `table` = { columns: string[], rows: (string|number)[][] }.
 */
function ChartCard({ title, subtitle, legend, table, empty, className = '', children }) {
  const [asTable, setAsTable] = useState(false)

  return (
    <Card interactive={false} className={className}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink dark:text-ink-dark">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted dark:text-ink-dark-muted">{subtitle}</p>}
        </div>
        {table && !empty && (
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            aria-label={asTable ? `Show ${title} as chart` : `Show ${title} as table`}
            title={asTable ? 'View as chart' : 'View as table'}
            className="rounded-md p-1.5 text-ink-muted transition-fast hover:bg-surface-muted hover:text-ink dark:text-ink-dark-muted dark:hover:bg-surface-dark dark:hover:text-ink-dark"
          >
            {asTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {empty ? (
        <p className="py-10 text-center text-sm text-ink-muted dark:text-ink-dark-muted">{empty}</p>
      ) : asTable && table ? (
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-ink-muted dark:text-ink-dark-muted">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} className="pb-2 pr-3 font-medium last:text-right">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ink dark:text-ink-dark">
              {table.rows.map((row, i) => (
                <tr key={i} className="border-t border-border dark:border-border-dark">
                  {row.map((cell, j) => (
                    <td key={j} className="py-1.5 pr-3 tabular-nums last:text-right">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {legend && legend.length >= 2 && <Legend items={legend} />}
          <div className="mt-3">{children}</div>
        </>
      )}
    </Card>
  )
}

export default ChartCard
