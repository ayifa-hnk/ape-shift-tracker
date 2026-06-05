import { useState, useEffect } from 'react'
import ClockPanel from './components/ClockPanel'
import SummaryPanel from './components/SummaryPanel'
import ShiftsPanel from './components/ShiftsPanel'

export default function App() {
    const [shifts, setShifts] = useState([])
    const [active, setActive] = useState(null)
    const [summary, setSummary] = useState(null)
    const [classes, setClasses] = useState([])
    const [settings, setSettings] = useState([])

    useEffect(() => {
        fetchAll()
    }, [])

    async function fetchAll() {
        const [shiftsRes, activeRes, summaryRes, classesRes, settingsRes] = await Promise.all([
            fetch('http://localhost:3000/shifts/summary-list'),
            fetch('http://localhost:3000/shifts/active'),
            fetch('http://localhost:3000/shifts/summary'),
            fetch('http://localhost:3000/shifts/classes'),
            fetch('http://localhost:3000/settings')
        ])

        setShifts(await shiftsRes.json())
        setSummary(await summaryRes.json())
        setClasses(await classesRes.json())
        setSettings(await settingsRes.json())

        if (activeRes.ok) {
            setActive(await activeRes.json())
        } else {
            setActive(null)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#111',
            color: '#fff',
            display: 'flex',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                width: '100%',
                maxWidth: '70vw',
                height: 'calc(100vh - 32px)',
                overflow: 'hidden'
            }}>
                <div style={{ border: '0.5px solid #222', borderRadius: '4px', padding: '1rem', overflow: 'hidden' }}>
                    <ShiftsPanel shifts={shifts} classes={classes} active={active} onRefresh={fetchAll} />
                </div>
                <div style={{ border: '0.5px solid #222', borderRadius: '4px', padding: '1rem', height: '50%' }}>
                    <ClockPanel active={active} setActive={setActive} classes={classes} onRefresh={fetchAll} />
                </div>
                <div style={{ border: '0.5px solid #222', borderRadius: '4px', padding: '1rem', overflow: 'hidden' }}>
                    <SummaryPanel summary={summary} settings={settings} shifts={shifts} onRefresh={fetchAll} />
                </div>
            </div>
        </div>
    )
}