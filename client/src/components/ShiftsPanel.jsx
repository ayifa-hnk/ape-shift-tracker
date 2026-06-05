import { useState } from 'react'

const API = 'http://localhost:3000'

const formatDate = (iso) => {
    const d = new Date(iso)
    const today = new Date()
    const tomorrow = new Date()
    tomorrow.setDate(today.getDate() + 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

const toHHMM = (ms) => {
    const totalMinutes = Math.floor(ms / 1000 / 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h}h${String(m).padStart(2, '0')}`
}

const getShiftColor = (shift) => {
    if (!shift.end_at && shift.type === 'actual') return '#06B6D4'
    if (new Date(shift.start_at) > new Date()) return '#F59E0B'
    return null
}

const toDatetimeLocal = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const toISO = (local) => local ? new Date(local).toISOString() : null

export default function ShiftsPanel({ shifts, classes, active, onRefresh }) {
    const [expandedId, setExpandedId] = useState(null)
    const [breaks, setBreaks] = useState({})
    const [editingShift, setEditingShift] = useState(null)
    const [editingBreak, setEditingBreak] = useState(null)
    const [menuId, setMenuId] = useState(null)
    const [hoveredId, setHoveredId] = useState(null)
    const [showPresetForm, setShowPresetForm] = useState(false)
    const [preset, setPreset] = useState({ activity: '', class_name: '', start_at: '', end_at: '' })

    async function addPreset() {
        if (!preset.activity || !preset.class_name || !preset.start_at || !preset.end_at) return
        await fetch(`${API}/shifts/preset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activity: preset.activity,
                class_name: preset.class_name,
                start_at: toISO(preset.start_at),
                end_at: toISO(preset.end_at)
            })
        })
        setPreset({ activity: '', class_name: '', start_at: '', end_at: '' })
        setShowPresetForm(false)
        onRefresh()
    }

    async function convertPreset(shift) {
        if (active) return // already clocked in
        if (new Date() < new Date(shift.start_at)) return // too early
        await fetch(`${API}/shifts/clockin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity: shift.activity, class_name: shift.class_name })
        })
        await fetch(`${API}/shifts/${shift.id}`, { method: 'DELETE' })
        onRefresh()
    }

    async function toggleExpand(shift) {
        if (expandedId === shift.id) {
            setExpandedId(null)
            return
        }
        setExpandedId(shift.id)
        if (!breaks[shift.id]) {
            const res = await fetch(`${API}/shifts/${shift.id}/breaks`)
            const data = await res.json()
            setBreaks(prev => ({ ...prev, [shift.id]: data }))
        }
    }

    async function deleteShift(id) {
        await fetch(`${API}/shifts/${id}`, { method: 'DELETE' })
        setExpandedId(null)
        setMenuId(null)
        onRefresh()
    }

    async function saveEdit(shift) {
        await fetch(`${API}/shifts/${shift.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activity: editingShift.activity,
                class_name: editingShift.class_name,
                start_at: toISO(editingShift.start_at),
                end_at: editingShift.end_at ? toISO(editingShift.end_at) : null
            })
        })
        setEditingShift(null)
        setMenuId(null)
        onRefresh()
    }

    async function saveBreakEdit(shiftId) {
        await fetch(`${API}/shifts/${shiftId}/breaks/${editingBreak.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                start_at: toISO(editingBreak.start_at),
                end_at: editingBreak.end_at ? toISO(editingBreak.end_at) : null
            })
        })
        const res = await fetch(`${API}/shifts/${shiftId}/breaks`)
        const data = await res.json()
        setBreaks(prev => ({ ...prev, [shiftId]: data }))
        setEditingBreak(null)
        onRefresh()
    }

    async function deleteBreak(shiftId, breakId) {
        await fetch(`${API}/shifts/${shiftId}/breaks/${breakId}`, { method: 'DELETE' })
        const res = await fetch(`${API}/shifts/${shiftId}/breaks`)
        const data = await res.json()
        setBreaks(prev => ({ ...prev, [shiftId]: data }))
        onRefresh()
    }

    const inputStyle = {
        padding: '6px 8px',
        border: '0.5px solid #2a2a2a',
        borderRadius: '3px',
        background: '#1a1a1a',
        color: '#fff',
        fontSize: '12px',
        fontWeight: 500,
        width: '100%',
        outline: 'none',
        boxSizing: 'border-box',
        colorScheme: 'dark'
    }

    const btnSm = (color, borderColor) => ({
        padding: '4px 8px',
        borderRadius: '3px',
        border: `0.5px solid ${borderColor ?? '#2a2a2a'}`,
        background: '#1a1a1a',
        color: color ?? '#666',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer'
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Shifts
                </div>
                <button
                    onClick={() => setShowPresetForm(p => !p)}
                    style={{ fontSize: '11px', fontWeight: 600, color: showPresetForm ? '#06B6D4' : '#555', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.05em' }}
                >
                    {showPresetForm ? 'Cancel' : '+ Preset'}
                </button>
            </div>

            {showPresetForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', padding: '10px 12px', background: '#141414', borderRadius: '3px', flexShrink: 0 }}>
                    <input placeholder='Activity' value={preset.activity} onChange={e => setPreset(p => ({ ...p, activity: e.target.value }))} style={inputStyle} />
                    <select value={preset.class_name} onChange={e => setPreset(p => ({ ...p, class_name: e.target.value }))} style={{ ...inputStyle, color: preset.class_name ? '#fff' : '#555' }}>
                        <option value=''>Class</option>
                        {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                    <div style={{ fontSize: '10px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</div>
                    <input type='datetime-local' value={preset.start_at} onChange={e => setPreset(p => ({ ...p, start_at: e.target.value }))} style={inputStyle} />
                    <div style={{ fontSize: '10px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</div>
                    <input type='datetime-local' value={preset.end_at} onChange={e => setPreset(p => ({ ...p, end_at: e.target.value }))} style={inputStyle} />
                    <button onClick={addPreset} style={{ padding: '7px', borderRadius: '3px', border: '0.5px solid #06B6D4', background: '#1a1a1a', color: '#06B6D4', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Add preset
                    </button>
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                {shifts.map(shift => {
                    const color = getShiftColor(shift)
                    const isExpanded = expandedId === shift.id
                    const shiftBreaks = breaks[shift.id] ?? []
                    const isEditing = editingShift?.id === shift.id
                    const isMenuOpen = menuId === shift.id
                    const isHovered = hoveredId === shift.id
                    const isPreset = shift.type === 'preset'

                    return (
                        <div key={shift.id} style={{ borderBottom: '0.5px solid #1a1a1a' }}>
                            <div
                                onMouseEnter={() => setHoveredId(shift.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onClick={() => {
                                    if (isMenuOpen) return
                                    if (isPreset) convertPreset(shift)
                                    else if (!isEditing) toggleExpand(shift)
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', cursor: isPreset ? 'pointer' : 'pointer', position: 'relative' }}
                            >
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: color ?? '#333' }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: color ?? '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {shift.activity}
                                    </div>
                                    <div style={{ fontSize: '11px', fontWeight: 500, color: '#444', marginTop: '2px' }}>
                                        {formatDate(shift.start_at)} · {formatTime(shift.start_at)}{shift.end_at ? ` - ${formatTime(shift.end_at)}` : ' - now'}
                                    </div>
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '2px', background: color ? `${color}18` : '#222', color: color ?? '#888', flexShrink: 0, letterSpacing: '0.04em' }}>
                                    {shift.class_name}
                                </div>
                                {shift.end_at && (
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#444', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                                        {toHHMM(new Date(shift.end_at) - new Date(shift.start_at) - (shift.break_ms ?? 0))}
                                    </div>
                                )}
                                {isHovered && (
                                    <div
                                        onClick={e => { e.stopPropagation(); setMenuId(isMenuOpen ? null : shift.id) }}
                                        style={{ fontSize: '14px', color: '#555', cursor: 'pointer', padding: '0 4px', flexShrink: 0, userSelect: 'none' }}
                                    >
                                        ···
                                    </div>
                                )}
                            </div>

                            {isMenuOpen && !isEditing && (
                                <div style={{ background: '#141414', borderRadius: '3px', padding: '6px 12px', marginBottom: '8px', display: 'flex', gap: '8px' }}>
                                    <button onClick={() => { setEditingShift({ ...shift, start_at: toDatetimeLocal(shift.start_at), end_at: toDatetimeLocal(shift.end_at) }); setExpandedId(shift.id) }} style={{ flex: 1, padding: '6px', borderRadius: '3px', border: '0.5px solid #2a2a2a', background: '#1a1a1a', color: '#888', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>✎ Edit</button>
                                    <button onClick={() => deleteShift(shift.id)} style={{ flex: 1, padding: '6px', borderRadius: '3px', border: '0.5px solid #E24B4A33', background: '#1a1a1a', color: '#E24B4A', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>✕ Delete</button>
                                </div>
                            )}

                            {isExpanded && !isEditing && !isPreset && (
                                <div style={{ background: '#141414', borderRadius: '3px', padding: '10px 12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Breaks</div>
                                        {shiftBreaks.length === 0 ? (
                                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#2a2a2a' }}>No breaks</div>
                                        ) : (
                                            shiftBreaks.map(b => (
                                                <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '0.5px solid #1e1e1e', gap: '8px' }}>
                                                    {editingBreak?.id === b.id ? (
                                                        <>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                                                                <input type='datetime-local' value={editingBreak.start_at} onChange={e => setEditingBreak(p => ({ ...p, start_at: e.target.value }))} style={{ ...inputStyle, fontSize: '11px' }} />
                                                                <input type='datetime-local' value={editingBreak.end_at ?? ''} onChange={e => setEditingBreak(p => ({ ...p, end_at: e.target.value }))} style={{ ...inputStyle, fontSize: '11px' }} />
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button onClick={() => saveBreakEdit(shift.id)} style={btnSm('#06B6D4', '#06B6D455')}>Save</button>
                                                                <button onClick={() => setEditingBreak(null)} style={btnSm('#666')}>✕</button>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#F59E0B' }}>{formatTime(b.start_at)} - {b.end_at ? formatTime(b.end_at) : 'ongoing'}</span>
                                                            <span style={{ fontSize: '11px', fontWeight: 500, color: '#444', flex: 1 }}>{b.end_at ? toHHMM(new Date(b.end_at) - new Date(b.start_at)) : ''}</span>
                                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                                <button onClick={() => setEditingBreak({ ...b, start_at: toDatetimeLocal(b.start_at), end_at: toDatetimeLocal(b.end_at) })} style={btnSm('#888')}>✎</button>
                                                                <button onClick={() => deleteBreak(shift.id, b.id)} style={btnSm('#E24B4A', '#E24B4A33')}>✕</button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {isEditing && (
                                <div style={{ background: '#141414', borderRadius: '3px', padding: '10px 12px', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <input value={editingShift.activity} onChange={e => setEditingShift(p => ({ ...p, activity: e.target.value }))} style={inputStyle} placeholder='Activity' />
                                    <select value={editingShift.class_name} onChange={e => setEditingShift(p => ({ ...p, class_name: e.target.value }))} style={{ ...inputStyle, color: '#fff' }}>
                                        {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                    <div style={{ fontSize: '10px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Start</div>
                                    <input type='datetime-local' value={editingShift.start_at} onChange={e => setEditingShift(p => ({ ...p, start_at: e.target.value }))} style={inputStyle} />
                                    <div style={{ fontSize: '10px', color: '#444', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>End</div>
                                    <input type='datetime-local' value={editingShift.end_at ?? ''} onChange={e => setEditingShift(p => ({ ...p, end_at: e.target.value }))} style={inputStyle} />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => saveEdit(shift)} style={{ flex: 1, padding: '7px', borderRadius: '3px', border: '0.5px solid #06B6D4', background: '#1a1a1a', color: '#06B6D4', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                                        <button onClick={() => { setEditingShift(null); setMenuId(null) }} style={{ flex: 1, padding: '7px', borderRadius: '3px', border: '0.5px solid #2a2a2a', background: '#1a1a1a', color: '#666', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}