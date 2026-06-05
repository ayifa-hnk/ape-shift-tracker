import { useState, useEffect } from 'react'
import TimeCard from './utils/TimeCard'
import LinearProgress from '@mui/material/LinearProgress'
import Box from '@mui/material/Box'
import TextField from '@mui/material/TextField'

const API = 'http://localhost:3000'

const fieldSx = {
    width: '80px',
    '& .MuiOutlinedInput-root': {
        background: '#161616',
        borderRadius: '3px',
        '& fieldset': { borderColor: '#2a2a2a' },
        '&:hover fieldset': { borderColor: '#3a3a3a' },
        '&.Mui-focused fieldset': { borderColor: '#444' },
        '& input': {
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            textAlign: 'right',
            padding: '5px 8px',
            MozAppearance: 'textfield'
        },
        '& input::-webkit-outer-spin-button': { display: 'none' },
        '& input::-webkit-inner-spin-button': { display: 'none' }
    }
}

const toHHMM = (ms) => {
    const totalMinutes = Math.floor(ms / 1000 / 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${h}h${String(m).padStart(2, '0')}`
}

function groupByMonth(shifts) {
    const map = {}
    shifts.filter(s => s.end_at).forEach(s => {
        const d = new Date(s.start_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        if (!map[key]) map[key] = { key, label, ms: 0 }
        map[key].ms += new Date(s.end_at) - new Date(s.start_at)
    })
    return Object.values(map).sort((a, b) => b.key.localeCompare(a.key))
}

export default function SummaryPanel({ summary, settings, shifts, onRefresh }) {
    const [payday, setPayday] = useState(25)
    const [targetHours, setTargetHours] = useState(60)
    const [selectedMonth, setSelectedMonth] = useState(null)

    useEffect(() => {
        if (settings && settings.length > 0) {
            const p = settings.find(s => s.name === 'payday')
            const t = settings.find(s => s.name === 'target_hours')
            if (p) setPayday(p.value)
            if (t) setTargetHours(t.value)
        }
    }, [settings])

    if (!summary) return <div style={{ color: '#666', padding: '1rem' }}>Loading...</div>

    async function saveSetting(name, value) {
        await fetch(`${API}/settings/${name}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: String(value) })
        })
        onRefresh()
    }

    function parseHHMM(str) {
        if (!str) return 0
        const match = str.match(/(\d+)h(\d+)/)
        if (!match) return parseFloat(str) * 60
        return parseInt(match[1]) * 60 + parseInt(match[2])
    }

    function handleExport() {
        if (!selectedMonth) return
        const [year, month] = selectedMonth.split('-').map(Number)
        const from = new Date(year, month - 2, Number(payday) + 1).toISOString()
        const to = new Date(year, month - 1, Number(payday)).toISOString()
        const url = `${API}/shifts/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        const a = document.createElement('a')
        a.href = url
        a.download = `shifts-${selectedMonth}.pdf`
        a.click()
    }

    const targetMinutes = parseHHMM(`${summary.target_hours ?? 60}h00`)
    const doneMinutes = parseHHMM(summary.done_hours)
    const progress = Math.min(100, Math.round((doneMinutes / targetMinutes) * 100))
    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const months = groupByMonth(shifts ?? [])

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>

            <div style={{ fontSize: '10px', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Summary
            </div>

            <div style={{ fontSize: '13px', fontWeight: 500, color: '#444' }}>
                {formatDate(summary.period.from)} → {formatDate(summary.period.to)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <TimeCard title='Done' value={summary.done_hours} />
                <TimeCard title='Breaks' value={summary.break_hours} />
                <TimeCard title='Planned' value={summary.preset_hours} />
                <TimeCard title='Projected' value={summary.projected_total} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#555' }}>Gap to target</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                        {summary.gap_projected} left
                    </span>
                </Box>
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                        height: 3,
                        borderRadius: 0,
                        backgroundColor: '#1e1e1e',
                        '& .MuiLinearProgress-bar': {
                            backgroundColor: '#06B6D4',
                            borderRadius: 0
                        }
                    }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#333' }}>0h</span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#333' }}>{summary.target_hours}h</span>
                </Box>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#666' }}>Payday</span>
                    <TextField
                        type='number'
                        value={payday}
                        onChange={e => {
                            const v = Math.min(28, Math.max(1, parseInt(e.target.value) || 1))
                            setPayday(v)
                        }}
                        onBlur={() => saveSetting('payday', payday)}
                        size='small'
                        inputProps={{ min: 1, max: 28 }}
                        sx={fieldSx}
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#666' }}>Target hours</span>
                    <TextField
                        type='number'
                        value={targetHours}
                        onChange={e => {
                            const v = Math.max(1, parseInt(e.target.value) || 1)
                            setTargetHours(v)
                        }}
                        onBlur={() => saveSetting('target_hours', targetHours)}
                        size='small'
                        inputProps={{ min: 1 }}
                        sx={fieldSx}
                    />
                </Box>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {months.map(m => (
                    <div
                        key={m.key}
                        onClick={() => setSelectedMonth(m.key === selectedMonth ? null : m.key)}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '7px 10px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            borderLeft: m.key === selectedMonth ? '2px solid #06B6D4' : '2px solid transparent',
                            background: m.key === selectedMonth ? '#06B6D415' : 'transparent'
                        }}
                    >
                        <span style={{ fontSize: '13px', fontWeight: 600, color: m.key === selectedMonth ? '#06B6D4' : '#fff' }}>{m.label}</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: m.key === selectedMonth ? '#06B6D4' : '#555', fontVariantNumeric: 'tabular-nums' }}>{toHHMM(m.ms)}</span>
                    </div>
                ))}
            </div>

            <button onClick={handleExport} style={{
                padding: '10px',
                borderRadius: '3px',
                border: '0.5px solid #2a2a2a',
                background: '#161616',
                color: selectedMonth ? '#fff' : '#555',
                fontSize: '13px',
                fontWeight: 600,
                cursor: selectedMonth ? 'pointer' : 'default',
                letterSpacing: '0.05em'
            }}>
                {selectedMonth ? `Export ${months.find(m => m.key === selectedMonth)?.label}` : 'Export'}
            </button>

        </div>
    )
}