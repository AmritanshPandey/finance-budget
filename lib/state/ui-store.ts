'use client'

import { create } from 'zustand'

import { currentMonth } from '@/lib/domain/month'
import type { ISOMonth } from '@/lib/domain/types'

interface UiStore {
  /** The month the Month view is showing. Client state, not a route — the
   *  month switcher is a swipe strip, not a destination. */
  selectedMonth: ISOMonth
  setSelectedMonth: (month: ISOMonth) => void
  /** Future timeline range, in months. */
  rangeMonths: number
  setRangeMonths: (months: number) => void
}

export const useUi = create<UiStore>((set) => ({
  selectedMonth: currentMonth(),
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  rangeMonths: 60,
  setRangeMonths: (rangeMonths) => set({ rangeMonths }),
}))
