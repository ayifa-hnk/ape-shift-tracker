const express = require('express')
const router = express.Router()
const db = require('../db')

module.exports = router

// Get settings list
router.get('/', (req, res) => {
    const settings = db.prepare('SELECT * FROM settings').all()
    res.status(200).json(settings)
})

// Edit settings
router.put('/:name', (req, res) => {
    const { value } = req.body
    if (!value) return res.status(400).json({ error: "Value needed" })

    // validate payday is a real day number
   if (req.params.name === 'payday') {
       const day = parseInt(value)
       if (isNaN(day) || day < 1 || day > 28) 
           return res.status(400).json({ error: 'Payday must be a day between 1 and 28' })
   }

    const setting = db.prepare('SELECT * FROM settings WHERE name = ?').get(req.params.name)
    if (!setting) return res.status(404).json({ error: 'Setting not found' })

    db.prepare('UPDATE settings SET value = ? WHERE name = ?')
        .run(value, req.params.name)

    res.status(200).json({ name: req.params.name, value })
})
