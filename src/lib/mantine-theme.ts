import { createTheme, type MantineColorsTuple } from "@mantine/core";

const colors: MantineColorsTuple = [
  "#f5f5f5",
  "#e7e7e7",
  "#cdcdcd",
  "#b2b2b2",
  "#9a9a9a",
  "#8b8b8b",
  "#848484",
  "#717171",
  "#656565",
  "#171717",
];

export const theme = createTheme({
  colors: { myColor: colors },
  fontFamily: "Geist Variable, sans-serif",
  headings: { fontFamily: "Geist Variable, sans-serif" },
  primaryColor: "myColor",
});
