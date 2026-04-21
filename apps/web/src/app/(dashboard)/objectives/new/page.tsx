'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Building2, Users, UserCircle, Target,
  Plus, Trash2, ChevronRight, ChevronLeft,
  CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Level = 'company' | 'department' | 'team' | 'individual'
type MetricType = 'percentage' | 'number' | 'currency' | 'binary'

interface KRDraft {
  id: string
  title: string
  metricType: MetricType
  startValue: string
  targetValue: string
  unit: string
}

interface FormState {
  level: Level | null
  title: string
  description: string
  cycleId: string
  department: string
  team: string
  parentObjectiveId: string
  visibility: 'public' | 'private'
  keyResults: KRDraft[]
}

const newKR = (): KRDraft => ({
  id: crypto.randomUUID(),
  title: '',
  metricType: 'number',
  startValue: '0',
  targetValue: '',
  unit: '',
})

// ─── Step indicators ──────────────────────────────────────────────────────────

const STEPS = ['Level', 'Details', 'Key Results', 'Review']

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
              i < current ? 'bg-blue-600 text-white'
              : i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100'
              : 'bg-gray-100 text-gray-400',
            )}>
              {i < current ? <CheckCircle2 size={16} /> : i + 1}
            </div>
            <span className={cn('text-xs mt-1 font-medium whitespace-nowrap',
              i <= current ? 'text-blue-600' : 'text-gray-400'
            )}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn('flex-1 h-px mx-2 mb-4 transition-colors',
              i < current ? 'bg-blue-600' : 'bg-gray-200'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Level card ───────────────────────────────────────────────────────────────

const LEVEL_OPTIONS: { value: Level; label: string; desc: string; icon: React.ReactNode }[] = [
  { value: 'company',    label: 'Company',    desc: 'Org-wide objective set by leadership', icon: <Building2 size={22} /> },
  { value: 'department', label: 'Department', desc: 'Owned by a department or function',     icon: <Users size={22} /> },
  { value: 'team',       label: 'Team',       desc: 'Squad or cross-functional team OKR',   icon: <UserCircle size={22} /> },
  { value: 'individual', label: 'Individual', desc: 'Personal objective for one employee',  icon: <Target size={22} /> },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewObjectivePage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<FormState>({
    level: null,
    title: '',
    description: '',
    cycleId: '',
    department: '',
    team: '',
    parentObjectiveId: '',
    visibility: 'public',
    keyResults: [newKR()],
  })

  const { data: cycles } = useQuery({ queryKey: ['cycles'], queryFn: () => api.cycles.list() })
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.org.departments() })
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => api.org.teams() })
  const { data: parentOptions } = useQuery({
    queryKey: ['objectives', 'parent-options', form.cycleId],
    queryFn: () => api.objectives.list(form.cycleId ? { cycleId: form.cycleId, status: 'active' } : undefined),
    enabled: step >= 1,
  })

  const set = (field: keyof FormState, value: any) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  // KR helpers
  const updateKR = (id: string, field: keyof KRDraft, value: string) => {
    setForm(f => ({
      ...f,
      keyResults: f.keyResults.map(kr => kr.id === id ? { ...kr, [field]: value } : kr),
    }))
  }
  const addKR = () => setForm(f => ({ ...f, keyResults: [...f.keyResults, newKR()] }))
  const removeKR = (id: string) => setForm(f => ({ ...f, keyResults: f.keyResults.filter(kr => kr.id !== id) }))

  // Validation
  const validate = (s: number): boolean => {
    const errs: Record<string, string> = {}
    if (s === 0 && !form.level) errs.level = 'Select a level to continue'
    if (s === 1) {
      if (!form.title.trim()) errs.title = 'Title is required'
      if (!form.cycleId) errs.cycleId = 'Select a cycle'
      if (form.level === 'department' && !form.department) errs.department = 'Select a department'
      if (form.level === 'team' && !form.team) errs.team = 'Select a team'
    }
    if (s === 2) {
      form.keyResults.forEach((kr, i) => {
        if (!kr.title.trim()) errs[`kr_${i}_title`] = 'Title required'
        if (!kr.targetValue || isNaN(Number(kr.targetValue))) errs[`kr_${i}_target`] = 'Valid target required'
      })
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => { if (validate(step)) setStep(s => s + 1) }
  const back = () => { setStep(s => s - 1); setErrors({}) }

  // Submit
  const mutation = useMutation({
    mutationFn: async () => {
      const objective = await api.objectives.create({
        title: form.title,
        description: form.description || null,
        level: form.level!,
        cycleId: form.cycleId,
        department: form.department || null,
        team: form.team || null,
        parentObjectiveId: form.parentObjectiveId || null,
        visibility: form.visibility,
      })
      const obj = objective as any
      // Create KRs sequentially
      for (const kr of form.keyResults) {
        if (kr.title.trim()) {
          await api.keyResults.create(obj.id, {
            title: kr.title,
            metricType: kr.metricType,
            startValue: Number(kr.startValue) || 0,
            targetValue: Number(kr.targetValue),
            unit: kr.unit || null,
          })
        }
      }
      return obj
    },
    onSuccess: (obj) => router.push(`/objectives/${obj.id}`),
  })

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Create OKR</h1>
        <p className="text-sm text-gray-500 mt-1">Set a new objective with measurable key results.</p>
      </div>

      <StepBar current={step} />

      {/* ── Step 0: Level ── */}
      {step === 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-4">What level is this objective?</h2>
          <div className="grid grid-cols-2 gap-3">
            {LEVEL_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => set('level', opt.value)}
                className={cn(
                  'text-left p-5 rounded-xl border-2 transition-all hover:border-blue-300',
                  form.level === opt.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white',
                )}
              >
                <div className={cn('mb-2', form.level === opt.value ? 'text-blue-600' : 'text-gray-400')}>
                  {opt.icon}
                </div>
                <div className="font-semibold text-gray-900">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
          {errors.level && (
            <p className="mt-3 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={13} /> {errors.level}
            </p>
          )}
        </div>
      )}

      {/* ── Step 1: Details ── */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-gray-800">Objective details</h2>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Become the #1 loyalty platform in APAC by revenue"
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors',
                errors.title ? 'border-red-300 focus:border-red-400' : 'border-gray-200 focus:border-blue-400',
              )}
            />
            {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does success look like? Add context that helps your team understand the 'why'."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 text-sm outline-none resize-none transition-colors"
            />
          </div>

          {/* Cycle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cycle <span className="text-red-400">*</span>
            </label>
            <select
              value={form.cycleId}
              onChange={e => set('cycleId', e.target.value)}
              className={cn(
                'w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors bg-white',
                errors.cycleId ? 'border-red-300' : 'border-gray-200 focus:border-blue-400',
              )}
            >
              <option value="">Select a cycle…</option>
              {cycles?.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.cycleId && <p className="mt-1 text-xs text-red-500">{errors.cycleId}</p>}
          </div>

          {/* Department (if level = department or team) */}
          {(form.level === 'department' || form.level === 'team') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Department {form.level === 'department' && <span className="text-red-400">*</span>}
              </label>
              <select
                value={form.department}
                onChange={e => set('department', e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border text-sm outline-none bg-white transition-colors',
                  errors.department ? 'border-red-300' : 'border-gray-200 focus:border-blue-400',
                )}
              >
                <option value="">Select department…</option>
                {departments?.map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {errors.department && <p className="mt-1 text-xs text-red-500">{errors.department}</p>}
            </div>
          )}

          {/* Team (if level = team) */}
          {form.level === 'team' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Team <span className="text-red-400">*</span>
              </label>
              <select
                value={form.team}
                onChange={e => set('team', e.target.value)}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border text-sm outline-none bg-white transition-colors',
                  errors.team ? 'border-red-300' : 'border-gray-200 focus:border-blue-400',
                )}
              >
                <option value="">Select team…</option>
                {teams?.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              {errors.team && <p className="mt-1 text-xs text-red-500">{errors.team}</p>}
            </div>
          )}

          {/* Parent Objective */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Aligned to (parent objective)
              <span className="ml-1.5 text-xs text-gray-400 font-normal">optional</span>
            </label>
            <select
              value={form.parentObjectiveId}
              onChange={e => set('parentObjectiveId', e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:border-blue-400 text-sm outline-none bg-white transition-colors"
            >
              <option value="">No parent (top-level)</option>
              {parentOptions?.filter((o: any) => o.level !== 'individual').map((o: any) => (
                <option key={o.id} value={o.id}>
                  [{o.level}] {o.title}
                </option>
              ))}
            </select>
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
            <div className="flex gap-3">
              {(['public', 'private'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('visibility', v)}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors',
                    form.visibility === v
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300',
                  )}
                >
                  {v === 'public' ? '🌐 Public' : '🔒 Private'}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              {form.visibility === 'public'
                ? 'Visible to everyone in your organisation.'
                : 'Only visible to you, your manager, and collaborators.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Step 2: Key Results ── */}
      {step === 2 && (
        <div>
          <h2 className="text-base font-semibold text-gray-800 mb-1">Add key results</h2>
          <p className="text-sm text-gray-500 mb-4">
            Define 1–5 measurable outcomes that indicate this objective is achieved.
          </p>

          <div className="space-y-4">
            {form.keyResults.map((kr, i) => (
              <KRCard
                key={kr.id}
                index={i}
                kr={kr}
                errors={errors}
                onChange={(field, value) => updateKR(kr.id, field, value)}
                onRemove={form.keyResults.length > 1 ? () => removeKR(kr.id) : undefined}
              />
            ))}
          </div>

          {form.keyResults.length < 5 && (
            <button
              onClick={addKR}
              className="mt-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <Plus size={16} /> Add another key result
            </button>
          )}
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Review & create</h2>

          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <Row label="Level" value={<span className="capitalize font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs">{form.level}</span>} />
            <Row label="Title" value={<span className="font-medium">{form.title}</span>} />
            {form.description && <Row label="Description" value={<span className="text-gray-600">{form.description}</span>} />}
            <Row label="Cycle" value={cycles?.find(c => c.id === form.cycleId)?.name ?? '—'} />
            {form.department && <Row label="Department" value={form.department} />}
            {form.team && <Row label="Team" value={form.team} />}
            {form.parentObjectiveId && (
              <Row label="Parent OKR" value={
                <span className="text-sm text-gray-700">
                  {(parentOptions as any[])?.find((o: any) => o.id === form.parentObjectiveId)?.title ?? 'Selected'}
                </span>
              } />
            )}
            <Row label="Visibility" value={<span className="capitalize">{form.visibility}</span>} />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
              Key Results ({form.keyResults.filter(kr => kr.title.trim()).length})
            </h3>
            <div className="space-y-2">
              {form.keyResults.filter(kr => kr.title.trim()).map((kr, i) => (
                <div key={kr.id} className="bg-white rounded-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{kr.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">
                      {kr.metricType.replace('_', ' ')} · {kr.startValue} → {kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {form.level !== 'individual' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>
                <strong>{form.level.charAt(0).toUpperCase() + form.level.slice(1)}</strong>-level objectives require approval from a manager or department lead before they become active.
              </span>
            </div>
          )}

          {mutation.error && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle size={14} /> {(mutation.error as Error).message}
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8 pt-5 border-t border-gray-100">
        <button
          onClick={step === 0 ? () => router.back() : back}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
        >
          <ChevronLeft size={16} />
          {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            onClick={next}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-1.5 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? (
              <><Loader2 size={15} className="animate-spin" /> Creating…</>
            ) : (
              <><CheckCircle2 size={15} /> Create OKR</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── KR Card ──────────────────────────────────────────────────────────────────

const METRIC_TYPES: { value: MetricType; label: string }[] = [
  { value: 'number',     label: 'Number' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'currency',   label: 'Currency' },
  { value: 'binary',     label: 'Binary (0/1)' },
]

function KRCard({
  index, kr, errors, onChange, onRemove,
}: {
  index: number
  kr: KRDraft
  errors: Record<string, string>
  onChange: (field: keyof KRDraft, value: string) => void
  onRemove?: () => void
}) {
  const isBinary = kr.metricType === 'binary'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Key Result {index + 1}
        </span>
        {onRemove && (
          <button onClick={onRemove} className="text-gray-300 hover:text-red-400 transition-colors">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Title */}
      <input
        type="text"
        value={kr.title}
        onChange={e => onChange('title', e.target.value)}
        placeholder="e.g. Grow ARR to $120M"
        className={cn(
          'w-full px-3 py-2 rounded-lg border text-sm outline-none mb-3 transition-colors',
          errors[`kr_${index}_title`] ? 'border-red-300' : 'border-gray-200 focus:border-blue-400',
        )}
      />
      {errors[`kr_${index}_title`] && (
        <p className="text-xs text-red-500 -mt-2 mb-3">{errors[`kr_${index}_title`]}</p>
      )}

      {/* Metric type */}
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1.5">Metric type</label>
        <div className="flex gap-2 flex-wrap">
          {METRIC_TYPES.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => {
                onChange('metricType', m.value)
                if (m.value === 'binary') { onChange('startValue', '0'); onChange('targetValue', '1') }
                if (m.value === 'percentage') { onChange('unit', '%') }
              }}
              className={cn(
                'text-xs px-2.5 py-1 rounded-md border font-medium transition-colors',
                kr.metricType === m.value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Values */}
      {!isBinary ? (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start value</label>
            <input
              type="number"
              value={kr.startValue}
              onChange={e => onChange('startValue', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 focus:border-blue-400 text-sm outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Target value <span className="text-red-400">*</span></label>
            <input
              type="number"
              value={kr.targetValue}
              onChange={e => onChange('targetValue', e.target.value)}
              className={cn(
                'w-full px-2.5 py-2 rounded-lg border text-sm outline-none transition-colors',
                errors[`kr_${index}_target`] ? 'border-red-300' : 'border-gray-200 focus:border-blue-400',
              )}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Unit</label>
            <input
              type="text"
              value={kr.unit}
              onChange={e => onChange('unit', e.target.value)}
              placeholder="M USD, logos…"
              className="w-full px-2.5 py-2 rounded-lg border border-gray-200 focus:border-blue-400 text-sm outline-none transition-colors"
            />
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          Binary: starts at <strong>0</strong> (not done) → target <strong>1</strong> (done)
        </div>
      )}
      {errors[`kr_${index}_target`] && (
        <p className="text-xs text-red-500 mt-1">{errors[`kr_${index}_target`]}</p>
      )}
    </div>
  )
}

// ─── Review row ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 flex-1">{value}</span>
    </div>
  )
}
