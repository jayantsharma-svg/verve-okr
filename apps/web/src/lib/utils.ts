import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Confidence, OkrStatus } from '@okr-tool/core'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function confidenceColor(confidence: Confidence): string {
  return {
    on_track: 'text-green-600 bg-green-50',
    at_risk: 'text-amber-600 bg-amber-50',
    off_track: 'text-red-600 bg-red-50',
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
  if (score >= 8) return 'text-green-600'
  if (score >= 5) return 'text-amber-600'
  return 'text-red-600'
}
