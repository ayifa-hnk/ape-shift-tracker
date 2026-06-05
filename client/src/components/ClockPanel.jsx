import { useEffect, useState } from 'react'

const API = 'http://localhost:3000'

export default function ClockPanel({ active, setActive, classes, onRefresh }) {
    const [activity, setActivity] = useState('')
    const [className, setClassName] = useState('')
    const [eTime, setETime] = useState('00:00:00')
    const [shiftTime, setShiftTime] = useState('00:00:00')

    const msToHMS = (ms) => {
        const h = String(Math.floor(ms / 3600000)).padStart(2, '0')
        const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')
        const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
        return `${h}:${m}:${s}`
    }

    useEffect(() => {
        if (!active) {
            setETime('00:00:00')
            return
        }

        const completedBreakms = (active.completed_breaks ?? []).reduce((acc, b) => {
            return acc + (new Date(b.end_at) - new Date(b.start_at))
        }, 0)

        if (active?.active_break) {
            // compute and freeze shift time at break start
            const frozen = (new Date(active.active_break.start_at) - new Date(active.start_at)) - completedBreakms
            const frozenStr = msToHMS(Math.max(0, frozen))
            setShiftTime(frozenStr)
            // seed eTime immediately so no wrong value flashes
            setETime('00:00:00')
        } else {
            // seed eTime with shiftTime string immediately before interval kicks in
            const seedms = (new Date() - new Date(active.start_at)) - completedBreakms
            setETime(msToHMS(Math.max(0, seedms)))
        }

        const tick = () => {
            if (active?.active_break) {
                const diff = new Date() - new Date(active.active_break.start_at)
                setETime(msToHMS(Math.max(0, diff)))
            } else {
                const diff = (new Date() - new Date(active.start_at)) - completedBreakms
                setETime(msToHMS(Math.max(0, diff)))
            }
        }

        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [active])

    async function clockIn() {
        if (!activity || !className) return
        await fetch(`${API}/shifts/clockin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activity, class_name: className })
        })
        setActivity('')
        setClassName('')
        onRefresh()
    }

    async function clockOut() {
        setActive(null)
        await fetch(`${API}/shifts/clockout`, { method: 'POST' })
        onRefresh()
    }

    async function startBreak() {
        setActive(prev => ({ ...prev, active_break: { start_at: new Date().toISOString() } }))
        await fetch(`${API}/shifts/${active.id}/break/start`, { method: 'POST' })
        onRefresh()
    }

    async function endBreak() {
        await fetch(`${API}/shifts/${active.id}/break/end`, { method: 'POST' })
        onRefresh()
    }

    const onBreak = active?.active_break != null

    const inputStyle = {
        padding: '9px 12px',
        border: '0.5px solid #2a2a2a',
        borderRadius: '3px',
        background: '#161616',
        color: '#fff',
        fontSize: '14px',
        fontWeight: 500,
        width: '100%',
        outline: 'none',
        boxSizing: 'border-box'
    }

    const btnStyle = (bg) => ({
        padding: '11px',
        borderRadius: '3px',
        border: 'none',
        background: bg,
        color: '#fff',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        width: '100%',
        letterSpacing: '0.03em'
    })

    const sectionTitle = active ? (onBreak ? 'Break in progress' : 'Shift in progress') : 'Clock in'

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '16px', flexShrink: 0 }}>
                {sectionTitle}
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    fontSize: '48px',
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.02em',
                    color: active ? (onBreak ? '#F59E0B' : '#06B6D4') : '#ffffff14'
                }}>
                    {eTime}
                </div>
                {active && (
                    <div style={{ fontSize: '11px', fontWeight: 600, color: onBreak ? '#F59E0B' : '#06B6D4', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {onBreak ? 'break time' : 'shift time'}
                    </div>
                )}
                {active && (
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#444', marginTop: '10px' }}>
                        {active.activity} · <span style={{ color: '#555' }}>{active.class_name}</span>
                    </div>
                )}
                {active && onBreak && (
                    <div style={{ fontSize: '12px', color: '#3a3a3a', marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}>
                        shift so far: <span style={{ color: '#555', fontWeight: 600 }}>{shiftTime}</span>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                {!active && (
                    <>
                        <input
                            placeholder='Activity'
                            value={activity}
                            onChange={e => setActivity(e.target.value)}
                            style={inputStyle}
                        />
                        <select
                            value={className}
                            onChange={e => setClassName(e.target.value)}
                            style={{ ...inputStyle, color: className ? '#fff' : '#555' }}
                        >
                            <option value=''>Class</option>
                            {classes.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                        </select>
                        <button onClick={clockIn} style={btnStyle('#06B6D4')}>Clock in</button>
                    </>
                )}
                {active && !onBreak && (
                    <>
                        <button onClick={startBreak} style={btnStyle('#F59E0B')}>Start break</button>
                        <button onClick={clockOut} style={btnStyle('#E24B4A')}>Clock out</button>
                    </>
                )}
                {active && onBreak && (
                    <button onClick={endBreak} style={btnStyle('#06B6D4')}>End break</button>
                )}
            </div>

        </div>
    )
}