'use client'

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { EChartsOption } from 'echarts'

// Only what is used, so the bundle carries only the charts that exist.
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
])

/**
 * A chart that owns its own instance and cleans up after itself. ECharts needs
 * a real element with a measured size, so it is created in an effect and kept
 * in step with the container by a ResizeObserver.
 */
export function EChart({
  option,
  height = 240,
  className,
  onEvents,
}: {
  option: EChartsOption
  height?: number
  className?: string
  onEvents?: Record<string, (params: unknown) => void>
}) {
  const container = useRef<HTMLDivElement>(null)
  const chart = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!container.current) return
    const instance = echarts.init(container.current, undefined, { renderer: 'canvas' })
    chart.current = instance

    const observer = new ResizeObserver(() => instance.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      instance.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    // `true` replaces the option rather than merging, so removed series go away.
    chart.current?.setOption(option, true)
  }, [option])

  useEffect(() => {
    const instance = chart.current
    if (!instance || !onEvents) return
    for (const [event, handler] of Object.entries(onEvents)) instance.on(event, handler)
    return () => {
      for (const [event, handler] of Object.entries(onEvents)) instance.off(event, handler)
    }
  }, [onEvents])

  return <div ref={container} className={className} style={{ height, width: '100%' }} />
}
