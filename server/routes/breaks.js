const express = require('express')
const router = express.Router()
const db = require('../db')
const { v4: uuidv4 } = require('uuid')

module.exports = router

// Start a break on a shift
router.post('/:id/break/start', (req, res) => {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id)
    if (!shift) return res.status(404).json({ error: 'Shift not found' })
    if (shift.end_at) return res.status(400).json({ error: 'Shift is already closed' })

    // check no open break already exists
    const openBreak = db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NULL').get(req.params.id)
    if (openBreak) return res.status(400).json({ error: 'Break already in progress' })

    const newBreak = {
        id: uuidv4(),
        shift_id: req.params.id,
        start_at: new Date().toISOString(),
        end_at: null
    }

    db.prepare('INSERT INTO breaks (id, shift_id, start_at, end_at) VALUES (?, ?, ?, ?)')
        .run(newBreak.id, newBreak.shift_id, newBreak.start_at, newBreak.end_at)

    res.status(201).json(newBreak)
})

// End a break on a shift
router.post('/:id/break/end', (req, res) => {
    const openBreak = db.prepare('SELECT * FROM breaks WHERE shift_id = ? AND end_at IS NULL').get(req.params.id)
    if (!openBreak) return res.status(400).json({ error: 'No break in progress' })

    const end_at = new Date().toISOString()
    db.prepare('UPDATE breaks SET end_at = ? WHERE id = ?').run(end_at, openBreak.id)

    res.status(200).json({ ...openBreak, end_at })
})

// GET all breaks for a shift
router.get('/:id/breaks', (req, res) => {
    const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(req.params.id)
    if (!shift) return res.status(404).json({ error: 'Shift not found' })

    const breaks = db.prepare('SELECT * FROM breaks WHERE shift_id = ? ORDER BY start_at ASC').all(req.params.id)
    res.status(200).json(breaks)
})

// Edit a break
router.put('/:id/breaks/:bid', (req, res) => {
    const { start_at, end_at } = req.body
    const b = db.prepare('SELECT * FROM breaks WHERE id = ? AND shift_id = ?').get(req.params.bid, req.params.id)
    if (!b) return res.status(404).json({ error: 'Break not found' })

    db.prepare('UPDATE breaks SET start_at = ?, end_at = ? WHERE id = ?')
        .run(start_at ?? b.start_at, end_at ?? b.end_at, req.params.bid)

    res.status(200).json({ ...b, start_at: start_at ?? b.start_at, end_at: end_at ?? b.end_at })
})

// Delete a break
router.delete('/:id/breaks/:bid', (req, res) => {
    const b = db.prepare('SELECT * FROM breaks WHERE id = ? AND shift_id = ?').get(req.params.bid, req.params.id)
    if (!b) return res.status(404).json({ error: 'Break not found' })

    db.prepare('DELETE FROM breaks WHERE id = ?').run(req.params.bid)
    res.status(200).json({ deleted: true })
})
