export type FieldType = 'date' | 'check' | 'notes' | 'text'

export type ExhibitId = 'pop' | 'wellspring' | 'torn'

export interface ExhibitField {
  id: string
  label: string
  type: FieldType
}

export interface ChecklistEntry {
  id: string
  values: Record<string, string | boolean>
}

export interface ExhibitDefinition {
  id: ExhibitId
  name: string
  shortName: string
  description: string
  accent: string
  fields: ExhibitField[]
  seedRows?: Array<Record<string, string | boolean>>
}

export const EXHIBITS: ExhibitDefinition[] = [
  {
    id: 'pop',
    name: 'Power Of Place',
    shortName: 'Power of Place',
    description: 'Audio, projector, and lighting log for the Power Of Place exhibit.',
    accent: '#5ce1e6',
    fields: [
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'audioCheck', label: 'Audio Status', type: 'check' },
      { id: 'projectorCheck', label: 'Projector Status', type: 'check' },
      { id: 'lighting', label: 'Lighting Status', type: 'check' },
      { id: 'notes', label: 'Notes / Issues Found', type: 'notes' },
      { id: 'checkedBy', label: 'Checked By', type: 'text' },
    ],
    seedRows: [
      {
        date: '',
        audioCheck: false,
        projectorCheck: false,
        lighting: false,
        notes: 'Projector 3 still shows no source. Turned Projector 3 off.',
        checkedBy: 'JR',
      },
    ],
  },
  {
    id: 'wellspring',
    name: 'Wellspring',
    shortName: 'Wellspring',
    description: 'TV, projector, audio, and headphone walkthrough for Wellspring.',
    accent: '#f6bd60',
    fields: [
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'audioCheck', label: 'Audio Status', type: 'check' },
      { id: 'videoCheck', label: 'Video Status', type: 'check' },
      { id: 'headphoneCheck', label: 'Headphone Status', type: 'check' },
      { id: 'projectorCheck', label: 'Projector Status', type: 'check' },
      { id: 'lighting', label: 'Lighting Status', type: 'check' },
      { id: 'notes', label: 'Notes / Issues Found', type: 'notes' },
      { id: 'checkedBy', label: 'Checked By', type: 'text' },
    ],
    seedRows: [
      {
        date: '',
        audioCheck: false,
        videoCheck: false,
        headphoneCheck: false,
        projectorCheck: false,
        lighting: false,
        notes: 'Headphones in the library needed changed to channel 2',
        checkedBy: 'JR',
      },
    ],
  },
  {
    id: 'torn',
    name: 'Torn',
    shortName: 'Torn',
    description: 'iPad, audio, and video log for the Torn exhibit.',
    accent: '#ef476f',
    fields: [
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'powerOperational', label: 'iPad Status', type: 'check' },
      { id: 'audioCheck', label: 'Audio Status', type: 'check' },
      { id: 'videoCheck', label: 'Video Status', type: 'check' },
      { id: 'notes', label: 'Notes / Issues Found', type: 'notes' },
      { id: 'checkedBy', label: 'Checked By', type: 'text' },
    ],
    seedRows: [
      {
        date: '',
        powerOperational: false,
        audioCheck: false,
        videoCheck: false,
        notes: 'No issues found.',
        checkedBy: 'JR',
      },
    ],
  },
]

export const STORAGE_KEY = 'daily-exhibit-checklist-state-v1'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function getTodayIsoDate(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function createEntry(
  exhibit: ExhibitDefinition,
  overrides: Record<string, string | boolean> = {},
  defaultToToday = true,
): ChecklistEntry {
  const baseValues = exhibit.fields.reduce<Record<string, string | boolean>>((accumulator, field) => {
    if (field.type === 'check') {
      accumulator[field.id] = false
    } else if (field.type === 'date') {
      accumulator[field.id] = defaultToToday ? getTodayIsoDate() : ''
    } else {
      accumulator[field.id] = ''
    }

    return accumulator
  }, {})

  return {
    id: generateId(),
    values: {
      ...baseValues,
      ...overrides,
    },
  }
}

export function createInitialState(): Record<ExhibitId, ChecklistEntry[]> {
  return EXHIBITS.reduce<Record<ExhibitId, ChecklistEntry[]>>((accumulator, exhibit) => {
    accumulator[exhibit.id] = (exhibit.seedRows ?? []).map((row) => createEntry(exhibit, row, false))
    return accumulator
  }, {} as Record<ExhibitId, ChecklistEntry[]>)
}