import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Confidence, OkrStatus } from '@okr-tool/core'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function confidenceColor(confidence: Confidence): string {
  return {
    on_track:  'text-cap-green  bg-cap-green-l',
    at_risk:   'text-cap-amber  bg-cap-amber-l',
    off_track: 'text-cap-red    bg-cap-red-l',
  }[confidence]
}

export function confidenceLabel(confidence: Confidence): string {
  return { on_track: 'On Track', at_risk: 'At Risk', off_track: 'Off Track' }[confidence]
}

export function statusLabel(status: OkrStatus): string {
  return {
    draft: 'Draft', pending_approval: 'Pending Approval',
    active: 'Active', closed: 'Closed', deleted: 'Deleted',
  }[status]
}

export function progressPct(current: number, start: number, target: number): number {
  if (target === start) return 0
  return Math.min(100, Math.max(0, Math.round(((current - start) / (target - start)) * 100)))
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function smartScoreColor(score: number): string {
  if (score >= 8) return 'text-cap-green'
  if (score >= 5) return 'text-cap-amber'
  return 'text-cap-red'
}
