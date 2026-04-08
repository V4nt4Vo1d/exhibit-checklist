import { useEffect, useMemo, useRef, useState } from 'react'
import {
  EXHIBITS,
  STORAGE_KEY,
  createEntry,
  createInitialState,
  type ChecklistEntry,
  type ExhibitDefinition,
  type ExhibitId,
} from './data'
import './styles.css'

type ChecklistState = Record<ExhibitId, ChecklistEntry[]>

function parseChecklist(parsed: Partial<ChecklistState>, fallback: ChecklistState): ChecklistState {
  return EXHIBITS.reduce<ChecklistState>((accumulator, exhibit) => {
    const rows = parsed[exhibit.id]
    accumulator[exhibit.id] = Array.isArray(rows) ? rows : fallback[exhibit.id]
    return accumulator
  }, {} as ChecklistState)
}

function decodeHashState(): ChecklistState | null {
  try {
    const hash = window.location.hash.slice(1)
    if (!hash) return null
    const json = atob(hash)
    const parsed = JSON.parse(json) as Partial<ChecklistState>
    return parseChecklist(parsed, createInitialState())
  } catch {
    return null
  }
}

function encodeState(state: ChecklistState): string {
  return btoa(JSON.stringify(state))
}

function loadState(): ChecklistState {
  const fallback = createInitialState()

  // Shared link takes priority on first load
  const fromHash = decodeHashState()
  if (fromHash) {
    // Clear the hash from the URL so refreshing doesn't keep re-importing
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return fromHash
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw) as Partial<ChecklistState>
    return parseChecklist(parsed, fallback)
  } catch {
    return fallback
  }
}

function isCheckComplete(exhibit: ExhibitDefinition, entry: ChecklistEntry): boolean {
  const checkFields = exhibit.fields.filter((field) => field.type === 'check')
  if (checkFields.length === 0) {
    return false
  }

  return checkFields.every((field) => Boolean(entry.values[field.id]))
}

function escapeCsv(value: string | boolean): string {
  const stringValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value
  return `"${stringValue.split('"').join('""')}"`
}

const SYNC_URL = '/api/sync'

async function fetchServerState(): Promise<ChecklistState | null> {
  try {
    const res = await fetch(SYNC_URL)
    if (!res.ok) return null
    const parsed = (await res.json()) as Partial<ChecklistState>
    return parseChecklist(parsed, createInitialState())
  } catch {
    return null
  }
}

async function pushServerState(state: ChecklistState): Promise<boolean> {
  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    return res.ok
  } catch {
    return false
  }
}

export default function App() {
  const [activeExhibitId, setActiveExhibitId] = useState<ExhibitId>(EXHIBITS[0].id)
  const [checklists, setChecklists] = useState<ChecklistState>(() => loadState())
  const [saveStamp, setSaveStamp] = useState('Connecting…')
  const [copyLabel, setCopyLabel] = useState('Copy Share Link')
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const footerYear = new Date().getFullYear()

  useEffect(() => {
    fetchServerState().then((serverState) => {
      if (serverState) {
        setChecklists(serverState)
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serverState))
        setSaveStamp(`Synced at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
      } else {
        setSaveStamp('Local only (server unreachable)')
      }
      isFirstRender.current = false
    })
  }, [])

  useEffect(() => {
    if (isFirstRender.current) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(checklists))
    pushServerState(checklists).then((ok) => {
      setSaveStamp(
        ok
          ? `Synced at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
          : `Saved locally at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} (offline)`,
      )
    })
  }, [checklists])

  const activeExhibit = useMemo(
    () => EXHIBITS.find((exhibit) => exhibit.id === activeExhibitId) ?? EXHIBITS[0],
    [activeExhibitId],
  )

  const activeRows = checklists[activeExhibit.id]
  const completedCount = activeRows.filter((entry) => isCheckComplete(activeExhibit, entry)).length

  function renderFieldControl(entry: ChecklistEntry, field: ExhibitDefinition['fields'][number]) {
    const rawValue = entry.values[field.id]

    if (field.type === 'check') {
      const checked = Boolean(rawValue)
      return (
        <button
          type="button"
          className={checked ? 'check-toggle checked' : 'check-toggle'}
          aria-pressed={checked}
          onClick={() => updateField(entry.id, field.id, !checked)}
        >
          <span className="checkmark">{checked ? '✓' : ''}</span>
        </button>
      )
    }

    if (field.type === 'date') {
      return (
        <input
          type="date"
          value={String(rawValue ?? '')}
          onChange={(event) => updateField(entry.id, field.id, event.target.value)}
        />
      )
    }

    if (field.type === 'notes') {
      return (
        <textarea
          rows={3}
          value={String(rawValue ?? '')}
          placeholder="Document issues, changes, or follow-up items"
          onChange={(event) => updateField(entry.id, field.id, event.target.value)}
        />
      )
    }

    return (
      <input
        type="text"
        value={String(rawValue ?? '')}
        placeholder={field.label}
        onChange={(event) => updateField(entry.id, field.id, event.target.value)}
      />
    )
  }

  function addRow() {
    setChecklists((current) => ({
      ...current,
      [activeExhibit.id]: [createEntry(activeExhibit), ...current[activeExhibit.id]],
    }))
  }

  function updateField(entryId: string, fieldId: string, value: string | boolean) {
    setChecklists((current) => ({
      ...current,
      [activeExhibit.id]: current[activeExhibit.id].map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              values: {
                ...entry.values,
                [fieldId]: value,
              },
            }
          : entry,
      ),
    }))
  }

  function removeRow(entryId: string) {
    setChecklists((current) => ({
      ...current,
      [activeExhibit.id]: current[activeExhibit.id].filter((entry) => entry.id !== entryId),
    }))
  }

  function resetExhibit() {
    setChecklists((current) => ({
      ...current,
      [activeExhibit.id]: [],
    }))
  }

  function copyShareLink() {
    const url = `${window.location.origin}${window.location.pathname}#${encodeState(checklists)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopyLabel('Copied!')
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopyLabel('Copy Share Link'), 2500)
    })
  }

  function exportCurrentExhibit() {
    const header = activeExhibit.fields.map((field) => escapeCsv(field.label)).join(',')
    const rows = activeRows.map((entry) =>
      activeExhibit.fields.map((field) => escapeCsv(entry.values[field.id] ?? '')).join(','),
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeExhibit.id}-daily-checklist.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="layout">
        <section className="hero-card">
          <div>
            <p className="eyebrow">MEC Exhibit Log</p>
            <h1>Daily MEC Exhibit Checklist</h1>
            <p className="hero-copy">
              This is a simple locally hosted checklist app for daily exhibit walkthroughs created by <a className="author-link" href="https://vantaproject.space" target="_blank" rel="noopener noreferrer">Jacob Raifsnider</a>. This app is designed to track 
              daily status of the new MEC exhibits <br /> (Power of Place, Wellspring, Torn), along with any issues that come up during walkthroughs. <br /> This is mainly meant to be used by me lol :) Data is saved in your browser automatically.
           </p>
          </div>

          <div className="status-panel">
            <div>
              <span className="status-label">Active exhibit</span>
              <strong>{activeExhibit.name}</strong>
            </div>
            <div>
              <span className="status-label">Completed rows</span>
              <strong>
                {completedCount} / {activeRows.length}
              </strong>
            </div>
            <div>
              <span className="status-label">Storage</span>
              <strong>{saveStamp}</strong>
            </div>
            <button type="button" className="share-button desktop-only" onClick={copyShareLink}>
              {copyLabel}
            </button>
          </div>
        </section>

        <section className="tabs-card">
          <div className="tabs-row" role="tablist" aria-label="Exhibit tabs">
            {EXHIBITS.map((exhibit) => (
              <button
                key={exhibit.id}
                type="button"
                role="tab"
                aria-selected={activeExhibit.id === exhibit.id}
                className={`${activeExhibit.id === exhibit.id ? 'tab-button active' : 'tab-button'} ${
                  exhibit.shortName.toLowerCase() === exhibit.name.toLowerCase() ? 'single-line' : ''
                }`}
                style={{ ['--tab-accent' as string]: exhibit.accent }}
                onClick={() => setActiveExhibitId(exhibit.id)}
              >
                <span>{exhibit.shortName}</span>
                {exhibit.shortName.toLowerCase() !== exhibit.name.toLowerCase() && <small>{exhibit.name}</small>}
              </button>
            ))}
          </div>

          <div className="exhibit-header">
            <div>
              <h2>{activeExhibit.name}</h2>
              <p>{activeExhibit.description}</p>
            </div>

            <div className="toolbar">
              <button type="button" className="primary-button" onClick={addRow}>
                Add Today
              </button>
              <button type="button" className="ghost-button desktop-only" onClick={exportCurrentExhibit}>
                Export CSV
              </button>
              <button type="button" className="ghost-button danger" onClick={resetExhibit}>
                Clear Tab
              </button>
            </div>
          </div>

          <div className="table-shell desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  {activeExhibit.fields.map((field) => (
                    <th key={field.id}>{field.label}</th>
                  ))}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeRows.length === 0 ? (
                  <tr>
                    <td className="empty-state" colSpan={activeExhibit.fields.length + 2}>
                      No entries yet. Use Add Today to start the daily log for this exhibit.
                    </td>
                  </tr>
                ) : (
                  activeRows.map((entry) => {
                    const complete = isCheckComplete(activeExhibit, entry)
                    return (
                      <tr key={entry.id}>
                        <td>
                          <span className={complete ? 'mobile-status complete' : 'mobile-status'}>
                            {complete ? 'Complete' : 'In Progress'}
                          </span>
                        </td>
                        {activeExhibit.fields.map((field) => (
                          <td key={field.id} className={field.type === 'check' ? 'check-cell' : field.type === 'notes' ? 'notes-cell' : ''}>
                            {renderFieldControl(entry, field)}
                          </td>
                        ))}
                        <td>
                          <button type="button" className="row-action" onClick={() => removeRow(entry.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-cards">
            {activeRows.length === 0 ? (
              <div className="empty-state mobile-empty-state">
                No entries yet. Use Add Today to start the daily log for this exhibit.
              </div>
            ) : (
              activeRows.map((entry, index) => {
                const complete = isCheckComplete(activeExhibit, entry)

                return (
                  <article key={entry.id} className="mobile-card">
                    <div className="mobile-card-header">
                      <div>
                        <span className="mobile-card-kicker">Entry {activeRows.length - index}</span>
                        <strong>{String(entry.values.date ?? '') || 'New daily log'}</strong>
                      </div>
                      <span className={complete ? 'mobile-status complete' : 'mobile-status'}>
                        {complete ? 'Complete' : 'In Progress'}
                      </span>
                    </div>

                    <div className="mobile-fields">
                      {activeExhibit.fields.map((field) => (
                        <label
                          key={field.id}
                          className={field.type === 'check' ? 'mobile-field mobile-field-check' : 'mobile-field'}
                        >
                          <span className="mobile-field-label">{field.label}</span>
                          <div className="mobile-field-control">{renderFieldControl(entry, field)}</div>
                        </label>
                      ))}
                    </div>

                    <button type="button" className="row-action mobile-remove" onClick={() => removeRow(entry.id)}>
                      Remove Entry
                    </button>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <span>© {footerYear}</span>
        <span>Jacob Raifsnider</span>
      </footer>
    </div>
  )
}