import React, { FC, SyntheticEvent, useCallback, useState } from "react"
import { ScopedCssBaseline, Tabs, Tab, Typography, Box, SvgIcon } from "@mui/material"

import Base, { theme } from "app/Base"
import TabPanel, { a11yProps } from "components/TabPanel"

import { mdiAccount, mdiBagPersonal, mdiHexagonMultiple, mdiSwordCross } from "@mdi/js"

import { css } from "@emotion/react"

interface SheetProps {
  name: string
}

const tabs = [
  {
    icon: mdiAccount,
    label: `Attributes`,
  },
  {
    icon: mdiAccount,
    label: `Advantages`,
  },
  {
    icon: mdiHexagonMultiple,
    label: `Skills`,
  },
  {
    icon: mdiBagPersonal,
    label: `Equipments`,
  },
  {
    icon: mdiSwordCross,
    label: `Combat`,
  },
]

const MobileSheet: FC<SheetProps> = ({ name }: { name: string }) => {
  const [value, setValue] = useState(0)
  const handleChange = useCallback((event: SyntheticEvent, newValue: number) => setValue(newValue), [])

  return (
    <Base>
      <Tabs value={value} onChange={handleChange} variant="fullWidth" scrollButtons="auto">
        {tabs.map((tab, i) => (
          <Tab
            key={i}
            label={tab.label}
            icon={
              <SvgIcon>
                <path d={tab.icon}></path>
              </SvgIcon>
            }
            css={css`
              padding: ${theme.spacing(1)};
            `}
          ></Tab>
        ))}
      </Tabs>
      <TabPanel tab-id="tabs" value={value} index={0}>
        Attributes
      </TabPanel>
      <TabPanel tab-id="tabs" value={value} index={1}>
        Advantages
      </TabPanel>
      <TabPanel tab-id="tabs" value={value} index={2}>
        Skills
      </TabPanel>
      <TabPanel tab-id="tabs" value={value} index={3}>
        Equipments
      </TabPanel>
      <TabPanel tab-id="tabs" value={value} index={4}>
        Combat
      </TabPanel>
    </Base>
  )
}

export default MobileSheet
