import Box from '@mui/material/Box'

export default function TimeCard({ title, value }) {
    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            background: '#161616',
            border: '0.5px solid #222',
            borderRadius: '3px',
            padding: '10px 12px'
        }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {title}
            </span>
            <span style={{ fontSize: '24px', fontWeight: 600, color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
                {value}
            </span>
        </Box>
    )
}