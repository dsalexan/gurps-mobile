import React, { FC, ReactNode } from "react"
import { ScopedCssBaseline, ThemeProvider } from "@mui/material"

import theme from "./theme"

export interface BaseProps {
  children?: ReactNode
}

const Base: FC<BaseProps> = ({ children }) => {
  return (
    <ThemeProvider theme={theme}>
      <ScopedCssBaseline enableColorScheme>{children}</ScopedCssBaseline>
    </ThemeProvider>
  )
}

export default Base
export { default as theme } from "./theme"
