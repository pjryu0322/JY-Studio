import { spawn } from "node:child_process";

const port = process.env.WEB_PORT || "3000";
const child = spawn("next", ["start", "--hostname", "0.0.0.0", "--port", port], {
  stdio: "inherit",
  shell: true
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});