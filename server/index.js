const express = require('express')
const cors = require('cors')
const app = express()

app.disable('x-powered-by')
app.use(cors())
app.use(express.json())

// Shifts
const ShiftRouter = require('./routes/shifts')
app.use('/shifts', ShiftRouter)
// Breaks
const BreaksRouter = require('./routes/breaks')
app.use('/shifts', BreaksRouter)
// Settings
const SettingsRouter = require('./routes/settings')
app.use('/settings', SettingsRouter)

const path = require('path')
app.use(express.static(path.join(__dirname, '../client/dist')))
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'))
})

const PORT = 3000

app.listen(PORT, () => {
    console.log(`Server Running on port ${PORT}`)
})
