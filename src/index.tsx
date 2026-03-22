#!/usr/bin/env node
import { render } from "ink";

import { App } from "@/app/App";

process.stdout.write("\u001bc");

render(<App />, {
  exitOnCtrlC: false,
  kittyKeyboard: { mode: "auto" },
});
