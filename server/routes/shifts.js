const express = require('express')
const router = express.Router()
const db = require('../db')
const { v4: uuidv4 } = require('uuid')
const PDFDocument = require('pdfkit')

module.exports = router

// Clock-in
router.post('/clockin', (req, res) => {
    const { activity, class_name } = req.body
    if (!activity) return res.status(400).json({ error: "Activity name required" })
    if (!class_name) return res.status(400).json({ error: "Class name required" })

    const active = db.prepare('SELECT * FROM shifts WHERE end_at IS NULL AND type = ?').get('actual')
    if (active) return res.status(400).json({ error: "Already clocked-in" })

    const shift = {
        id: uuidv4(),
        activity,
        start_at: new Date().toISOString(),
        end_at: null,
        type: 'actual',
        created_at: new Date().toISOString(),
        class_name: class_name
    }

    db.prepare('INSERT INTO shifts (id, activity, start_at, end_at, type, created_at, class_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(shift.id, shift.activity, shift.start_at, shift.end_at, shift.type, shift.created_at, shift.class_name)

    res.status(201).json(shift)
})

//Clock-out (Only if clocked-in)
router.post('/clockout', (req, res) => {
    const active = db.prepare('SELECT * FROM shifts WHERE end_at IS NULL AND type = ?').get('actual')
    if (!active) return res.status(400).json({ error: "Not clocked-in" })

    const end_at = new Date().toISOString()

    db.prepare('UPDATE shifts SET end_at = ? WHERE id = ?')
        .run(end_at, active.id)

    res.status(200).json({ ...active, end_at })
})

// POST create a preset shift
router.post('/preset', (req, res) => {
    const { activity, class_name, start_at, end_at } = req.body
    if (!activity) return res.status(400).json({ error: 'Activity name is required' })
    if (!class_name) return res.status(400).json({ error: 'Class name is required' })
    if (!start_at) return res.status(400).json({ error: 'Shift start is required' })
    if (!end_at) return res.status(400).json({ error: 'Shift end is required' })

    const shift = {
        id: uuidv4(),
        activity,
        start_at,
        end_at,
        type: 'preset',
        created_at: new Date().toISOString(),
        class_name: class_name
    }

    db.prepare('INSERT INTO shifts (id, activity, start_at, end_at, type, created_at, class_name) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(shift.id, shift.activity, shift.start_at, shift.end_at, shift.type, shift.created_at, shift.class_name)

    res.status(201).json(shift)
})

// Get classes list
router.get('/classes', (req, res) => {
    const classes = db.prepare('SELECT * FROM classes ORDER BY name ASC').all()
    res.status(200).json(classes)
})

//Get shifts list
router.get('/', (req, res) => {
    const shifts = db.prepare('SELECT * FROM shifts ORDER BY start_at DESC').all();
    res.status(200).json(shifts)
})

//Get active shift
router.get('/active', (req, res) => {
    const active = db.prepare('SELECT * FROM shifts WHERE end_at IS NULL AND type = ?').get('actual')
    if (!active) return res.status(404).json({ error: "No active shifts" })

    const activeBreak = db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NULL').get(active.id)
    const completedBreaks = db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NOT NULL').all(active.id)

    res.status(200).json({ ...active, active_break: activeBreak ?? null, completed_breaks: completedBreaks })
})

//Edit shift
router.put('/:id', (req, res) => {
    const { activity, class_name, start_at, end_at } = req.body
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id)
    if (!shift) return res.status(404).json({ error: "Shift not found" })

    db.prepare('UPDATE shifts SET activity = ?, class_name = ?, start_at = ?, end_at = ? WHERE id = ?')
        .run(
            activity ?? shift.activity,
            class_name ?? shift.class_name,
            start_at ?? shift.start_at,
            end_at ?? shift.end_at,
            req.params.id
        )
    res.status(200).json({
        ...shift,
        activity: activity ?? shift.activity,
        class_name: class_name ?? shift.class_name,
        start_at: start_at ?? shift.start_at,
        end_at: end_at ?? shift.end_at
    })
})

//Delete shift
router.delete('/:id', (req, res) => {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id)
    if (!shift) return res.status(404).json({ error: "Shift not found" })
    db.prepare('DELETE FROM breaks WHERE shift_id = ?').run(req.params.id)
    db.prepare('DELETE FROM shifts WHERE id = ?').run(req.params.id)
    res.status(200).json({ deleted: true })
})

//Get shift summary
router.get('/summary', (req, res) => {
    const now = new Date()

    //Compute period
    const currentDay = now.getDate()
    let periodStart, periodEnd

    //Get payday
    const payday_row = db.prepare('SELECT value FROM settings WHERE name = ?').get('payday')
    const payday = payday_row ? parseInt(payday_row.value) : 25

    if (currentDay > payday) {
        // Past payday, period is this month to the next one
        // we are already in the next month compute
        periodStart = new Date(now.getFullYear(), now.getMonth(), payday + 1)
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, payday)
    } else {
        // Period is from last month's day after payday to this month payday
        periodStart = new Date(now.getFullYear(), now.getMonth() - 1, payday + 1)
        periodEnd = new Date(now.getFullYear(), now.getMonth(), payday)
    }

    // Target shift hours
    const target_hoursRow = db.prepare('SELECT value FROM settings WHERE name = ?').get('target_hours')
    const target_hours = req.query.target_hours ?? target_hoursRow?.value ?? '60'

    const from = periodStart
    const to = periodEnd

    // fetch all completed actual shifts in period
    const actualShifts = db.prepare(`
        SELECT * FROM shifts
        WHERE type = 'actual'
        AND end_at IS NOT NULL
        AND start_at >= ? AND start_at <= ?
    `).all(from.toISOString(), to.toISOString())

    // fetch all preset shifts in period
    const presetShifts = db.prepare(`
        SELECT * FROM shifts
        WHERE type = 'preset'
        AND start_at >= ? AND start_at <= ?
    `).all(from.toISOString(), to.toISOString())

    // compute hours from milliseconds
    const toHours = (ms) => {
        const totalMinutes = Math.floor(ms / 1000 / 60)
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60
        return `${hours}h${String(minutes).padStart(2, '0')}`
    }

    // Breaks total
    const breakms = actualShifts.reduce((acc, s) => {
        return acc + db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NOT NULL')
            .all(s.id)
            .reduce((bacc, b) => bacc + (new Date(b.end_at) - new Date(b.start_at)), 0)
    }, 0)
    // Raw shift hours
    const rawms = actualShifts.reduce((acc, s) => {return acc + (new Date(s.end_at) - new Date(s.start_at))}, 0)
    // Done shift hours
    const donems = rawms - breakms
    const presetms = presetShifts.reduce((acc, s) => acc + (new Date(s.end_at) - new Date(s.start_at)), 0)

    // round donems down to the nearest minute
    const roundedBreakms = Math.floor(breakms / 1000 / 60) * 60 * 1000
    const roundedRawms = Math.floor(rawms / 1000 / 60) * 60 * 1000
    const roundedDonems = Math.floor(donems / 1000 / 60) * 60 * 1000
    const roundedPresetms = Math.floor(presetms / 1000 / 60) * 60 * 1000
    
    const doneHours = toHours(roundedDonems)
    const breakHours = toHours(roundedBreakms)
    const presetHours = toHours(roundedPresetms)
    const projectedTotal = toHours(roundedDonems + roundedPresetms)
    
    const result = {
        period: { from: from.toISOString(), to: to.toISOString() },
        done_hours: doneHours,
        break_hours: breakHours,
        preset_hours: presetHours,
        projected_total: projectedTotal,
    }
    
    if (target_hours) {
        const targetms = parseFloat(target_hours) * 60 * 60 * 1000
        result.target_hours = target_hours
        result.gap = toHours(Math.max(0, targetms - roundedDonems))
        result.gap_wpreset = toHours(Math.max(0, targetms - (roundedDonems + roundedPresetms)))
    }
    res.status(200).json(result)
})

// Add to top of routes/shifts.js if not already there:
// const PDFDocument = require('pdfkit')

router.get('/export', (req, res) => {
    const { from, to } = req.query
    if (!from || !to) return res.status(400).json({ error: 'from and to are required' })

    const shifts = db.prepare(`
        SELECT * FROM shifts
        WHERE type = 'actual'
        AND end_at IS NOT NULL
        AND start_at >= ? AND start_at <= ?
        ORDER BY start_at ASC
    `).all(from, to)

    const toHHMM = (ms) => {
        const totalMinutes = Math.floor(ms / 1000 / 60)
        const h = Math.floor(totalMinutes / 60)
        const m = totalMinutes % 60
        return `${h}h${String(m).padStart(2, '0')}`
    }
    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

    const rows = shifts.map(s => {
        const breaks = db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NOT NULL').all(s.id)
        const breakms = breaks.reduce((acc, b) => acc + (new Date(b.end_at) - new Date(b.start_at)), 0)
        const shiftms = Math.floor(((new Date(s.end_at) - new Date(s.start_at)) - breakms) / 60000) * 60000
        return { ...s, breakms, shiftms }
    })

    const totalShiftms = rows.reduce((acc, r) => acc + r.shiftms, 0)
    const totalBreakms = rows.reduce((acc, r) => acc + r.breakms, 0)

    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="shifts-${from.slice(0,10)}-${to.slice(0,10)}.pdf"`)
    doc.pipe(res)

    // ── Header
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(22).text('APE Shift Tracker', 40, 40)
    doc.fillColor('#666666').font('Helvetica').fontSize(10)
       .text(`${formatDate(from)}  -  ${formatDate(to)}`, 40, 70)
    doc.fillColor('#999999').fontSize(9)
       .text(`${rows.length} shifts   ·   Total break: ${toHHMM(totalBreakms)}   ·   Total worked: ${toHHMM(totalShiftms)}`, 40, 88)

    // ── Table setup
    const tableLeft = 40
    const tableRight = 555 // A4 width 595 minus 40 margin
    const tableTop = 120
    const cols = [
        { key: 'activity',   label: 'Activity',   w: 140, align: 'left' },
        { key: 'class',      label: 'Class',      w: 65,  align: 'left' },
        { key: 'date',       label: 'Date',       w: 75,  align: 'left' },
        { key: 'period',     label: 'Period',     w: 90,  align: 'left' },
        { key: 'break',      label: 'Break',      w: 55,  align: 'right' },
        { key: 'shift',      label: 'Shift',      w: 90,  align: 'right' },
    ]

    // compute x positions
    let x = tableLeft
    cols.forEach(c => { c.x = x; x += c.w })

    const headerHeight = 22
    const rowHeight = 20

    // ── Header row (dark background)
    doc.rect(tableLeft, tableTop, tableRight - tableLeft, headerHeight).fill('#1a1a1a')
    doc.fillColor('#aaaaaa').font('Helvetica-Bold').fontSize(8)
    cols.forEach(c => {
        doc.text(c.label.toUpperCase(), c.x + 8, tableTop + 7, {
            width: c.w - 16,
            align: c.align,
            characterSpacing: 0.5
        })
    })

    // ── Data rows
    let y = tableTop + headerHeight
    rows.forEach((r, i) => {
        const isAlt = i % 2 === 1
        if (isAlt) {
            doc.rect(tableLeft, y, tableRight - tableLeft, rowHeight).fill('#f0f0f0')
        }
        doc.fillColor('#222222').font('Helvetica').fontSize(9)
        doc.text(r.activity, cols[0].x + 8, y + 6, { width: cols[0].w - 16, align: cols[0].align, ellipsis: true, lineBreak: false })
        doc.text(r.class_name, cols[1].x + 8, y + 6, { width: cols[1].w - 16, align: cols[1].align, lineBreak: false })
        doc.text(formatDate(r.start_at), cols[2].x + 8, y + 6, { width: cols[2].w - 16, align: cols[2].align, lineBreak: false })
        doc.text(`${formatTime(r.start_at)} - ${formatTime(r.end_at)}`, cols[3].x + 8, y + 6, { width: cols[3].w - 16, align: cols[3].align, lineBreak: false })
        doc.fillColor('#888888')
        doc.text(toHHMM(r.breakms), cols[4].x + 8, y + 6, { width: cols[4].w - 16, align: cols[4].align, lineBreak: false })
        doc.fillColor('#111111').font('Helvetica-Bold')
        doc.text(toHHMM(r.shiftms), cols[5].x + 8, y + 6, { width: cols[5].w - 16, align: cols[5].align, lineBreak: false })

        // row separator
        doc.moveTo(tableLeft, y + rowHeight).lineTo(tableRight, y + rowHeight).strokeColor('#eeeeee').lineWidth(0.5).stroke()
        y += rowHeight
    })

    // ── Total row
    doc.rect(tableLeft, y, tableRight - tableLeft, rowHeight + 2).fill('#1a1a1a')
    doc.fillColor('#aaaaaa').font('Helvetica-Bold').fontSize(8)
    doc.text('TOTAL', cols[3].x + 8, y + 7, { width: cols[3].w - 16, align: 'right', characterSpacing: 0.5, lineBreak: false })
    doc.fillColor('#aaaaaa').fontSize(9)
    doc.text(toHHMM(totalBreakms), cols[4].x + 8, y + 7, { width: cols[4].w - 16, align: cols[4].align, lineBreak: false })
    doc.fillColor('#ffffff').fontSize(10)
    doc.text(toHHMM(totalShiftms), cols[5].x + 8, y + 7, { width: cols[5].w - 16, align: cols[5].align, lineBreak: false })

    // ── Outer table border
    y += rowHeight + 2
    doc.rect(tableLeft, tableTop, tableRight - tableLeft, y - tableTop).strokeColor('#dddddd').lineWidth(0.5).stroke()

    // ── Footer
    doc.fillColor('#bbbbbb').font('Helvetica').fontSize(7)
       .text(`Generated ${new Date().toLocaleString('en-GB')}`, 40, 800, { width: 515, align: 'right' })

    doc.end()
})

router.get('/summary-list', (req, res) => {
    const shifts = db.prepare(`
        SELECT * FROM shifts ORDER BY start_at DESC
    `).all()

    const result = shifts.map(s => {
        if (!s.end_at) return { ...s, break_ms: 0 }
        const breaks = db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NOT NULL').all(s.id)
        const break_ms = breaks.reduce((acc, b) => acc + (new Date(b.end_at) - new Date(b.start_at)), 0)
        return { ...s, break_ms }
    })

    res.status(200).json(result)
})
