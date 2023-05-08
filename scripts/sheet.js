const express = require(`express`)
const cors = require(`cors`)

const app = express()
const PORT = 3456

const PATH = `G:\\My Drive\\RPG\\GURPS\\GCS`

app.use(cors())
app.use(express.static(PATH))

app.get(`/`, (req, res) => {
  res.send(`GCS Static Server`)
})

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`))
