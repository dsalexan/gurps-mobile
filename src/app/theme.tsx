import { createTheme } from "@mui/material"

import { blue } from "@mui/material/colors"

const theme = createTheme({
  spacing: 9,
  palette: {
    primary: {
      main: blue[500],
    },
  },
})

export default theme
