import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import BarList from './BarList'
import ChartCard from './ChartCard'
import ColumnChart from './ColumnChart'
import LineChart from './LineChart'
import { monthlyCounts, niceScale } from './chartUtils'

const SERIES = [{ label: 'Events', color: 'var(--chart-series-1)' }]

describe('niceScale', () => {
  it('uses whole-number ticks that cover the max', () => {
    expect(niceScale(3)).toEqual({ top: 3, ticks: [0, 1, 2, 3] })
    expect(niceScale(10).top).toBe(10)
    expect(niceScale(120).ticks).toEqual([0, 50, 100, 150])
  })

  it('falls back to a usable axis when there is no data', () => {
    const { top, ticks } = niceScale(0)
    expect(top).toBeGreaterThan(0)
    expect(ticks[0]).toBe(0)
  })
})

describe('monthlyCounts', () => {
  const now = new Date(2026, 8, 15) // September 2026

  it('buckets by calendar month across the requested window', () => {
    const items = [{ d: '2026-09-02T10:00:00' }, { d: '2026-09-28T10:00:00' }, { d: '2026-07-10T10:00:00' }, { d: '2020-01-01T00:00:00' }]
    const buckets = monthlyCounts(items, (i) => i.d, { before: 2, after: 1, now })
    expect(buckets).toHaveLength(4)
    expect(buckets.map((b) => b.value)).toEqual([1, 0, 2, 0]) // Jul, Aug, Sep, Oct; the 2020 item falls outside
  })

  it('can sum a value instead of counting', () => {
    const items = [{ d: '2026-09-02T10:00:00', amount: 40 }, { d: '2026-09-20T10:00:00', amount: 60 }]
    const buckets = monthlyCounts(items, (i) => i.d, { before: 0, now, getValue: (i) => i.amount })
    expect(buckets[0].value).toBe(100)
  })
})

describe('ChartCard', () => {
  it('swaps the plot for a table carrying the same numbers', async () => {
    render(
      <ChartCard title="Events per month" table={{ columns: ['Month', 'Events'], rows: [['August 2026', 5]] }}>
        <div>plot</div>
      </ChartCard>,
    )
    expect(screen.getByText('plot')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /show events per month as table/i }))

    expect(screen.queryByText('plot')).not.toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'August 2026' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '5' })).toBeInTheDocument()
  })

  it('shows the empty message instead of a chart when there is no data', () => {
    render(
      <ChartCard title="Spending" empty="No expenses yet." table={{ columns: [], rows: [] }}>
        <div>plot</div>
      </ChartCard>,
    )
    expect(screen.getByText('No expenses yet.')).toBeInTheDocument()
    expect(screen.queryByText('plot')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('only draws a legend for two or more series', () => {
    const legend = [
      { label: 'RSVPs', color: 'red' },
      { label: 'Attended', color: 'blue' },
    ]
    const { rerender } = render(<ChartCard title="Engagement" legend={legend}><div>plot</div></ChartCard>)
    expect(screen.getByText('RSVPs')).toBeInTheDocument()
    expect(screen.getByText('Attended')).toBeInTheDocument()

    rerender(<ChartCard title="Engagement" legend={[legend[0]]}><div>plot</div></ChartCard>)
    expect(screen.queryByText('RSVPs')).not.toBeInTheDocument()
  })
})

describe('ColumnChart', () => {
  const data = [
    { label: 'Jul', fullLabel: 'July 2026', values: [2] },
    { label: 'Aug', fullLabel: 'August 2026', values: [5] },
  ]

  it('exposes every column to keyboard focus and shows its value in a tooltip', () => {
    render(<ColumnChart ariaLabel="Events per month" series={SERIES} data={data} />)

    const august = screen.getByLabelText('August 2026: 5 Events')
    expect(august).toHaveAttribute('tabindex', '0')
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.focus(august)
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('August 2026')
    expect(tooltip).toHaveTextContent('5')

    fireEvent.blur(august)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('lists every series in the tooltip for grouped columns', () => {
    render(
      <ColumnChart
        ariaLabel="Engagement"
        series={[
          { label: 'RSVPs', color: 'red' },
          { label: 'Attended', color: 'blue' },
        ]}
        data={[{ label: 'Hack', values: [40, 31] }]}
      />,
    )
    fireEvent.focus(screen.getByLabelText('Hack: 40 RSVPs, 31 Attended'))
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('40')
    expect(tooltip).toHaveTextContent('RSVPs')
    expect(tooltip).toHaveTextContent('31')
    expect(tooltip).toHaveTextContent('Attended')
  })

  it('renders API-provided labels as text, never as markup', () => {
    render(
      <ColumnChart
        ariaLabel="Engagement"
        series={SERIES}
        data={[{ label: '<img src=x onerror=alert(1)>', values: [3] }]}
      />,
    )
    fireEvent.focus(screen.getByLabelText(/3 Events/))
    expect(screen.getByRole('tooltip').querySelector('img')).toBeNull()
  })
})

describe('LineChart', () => {
  it('steps through points with the arrow keys', () => {
    render(
      <LineChart
        ariaLabel="Events per month"
        series={SERIES[0]}
        data={[
          { label: 'Jul', fullLabel: 'July 2026', value: 2 },
          { label: 'Aug', fullLabel: 'August 2026', value: 5 },
          { label: 'Sep', fullLabel: 'September 2026', value: 3 },
        ]}
      />,
    )
    const plot = screen.getByLabelText(/use left and right arrow keys/i)
    fireEvent.focus(plot)
    expect(screen.getByRole('tooltip')).toHaveTextContent('September 2026')

    fireEvent.keyDown(plot, { key: 'ArrowLeft' })
    expect(screen.getByRole('tooltip')).toHaveTextContent('August 2026')
    expect(screen.getByRole('tooltip')).toHaveTextContent('5')
  })
})

describe('BarList', () => {
  it('scales bars against the largest value and labels each row', () => {
    render(<BarList items={[{ label: 'Tech', value: 8 }, { label: 'Sports', value: 2 }]} unit="clubs" />)
    const tech = screen.getByRole('meter', { name: 'Tech' })
    const sports = screen.getByRole('meter', { name: 'Sports' })
    expect(tech.firstChild).toHaveStyle({ width: '100%' })
    expect(sports.firstChild).toHaveStyle({ width: '25%' })
  })
})
