import React, { HTMLAttributes, ReactNode } from "react"
import { Box, Typography } from "@mui/material"

export function a11yProps(index: number) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  }
}

export interface TabPanelProps<T extends HTMLElement> extends HTMLAttributes<T> {
  children?: ReactNode
  index: number
  value: number
  // eslint-disable-next-line quotes
  "tab-id": string
}

export default function TabPanel<T extends HTMLDivElement>(props: TabPanelProps<T>) {
  const { "tab-id": tabId, children, value, index, ...other } = props

  return (
    <div role="tabpanel" hidden={value !== index} id={`${tabId}-tabpanel-${index}`} aria-labelledby={`${tabId}-tab-${index}`} {...other}>
      {value === index && (
        <Box sx={{ p: 3 }}>
          <Typography>{children}</Typography>
        </Box>
      )}
    </div>
  )
}
