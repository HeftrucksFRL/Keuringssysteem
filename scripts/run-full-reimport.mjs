import { execFileSync } from "node:child_process";
import path from "node:path";

const cwd = process.cwd();
const nodeExe = process.execPath;
const scriptsDir = path.join(cwd, "scripts");
const sourceDir = path.join(cwd, "Herimport keuringsapp");
const numberMap = path.join(sourceDir, "Import-nummer-matches.csv");

const importPlan = [
  {
    label: "heftruck historisch",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-heftruck-reachtruck-260414092951.csv"),
      "--type",
      "heftruck_reachtruck"
    ]
  },
  {
    label: "heftruck recent",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-heftruck-reachtruck-260414085956.csv"),
      "--type",
      "heftruck_reachtruck"
    ]
  },
  {
    label: "pallet historisch",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-palletwagen-heffer-en-stapelaar-260414092717.csv"),
      "--type",
      "palletwagen_stapelaar"
    ]
  },
  {
    label: "pallet recent",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-palletwagen-heffer-en-stapelaar-260414090101.csv"),
      "--type",
      "palletwagen_stapelaar"
    ]
  },
  {
    label: "hoogwerker historisch",
    script: "import-hoogwerkers.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-hoogwerker-260414093025.csv")
    ]
  },
  {
    label: "hoogwerker recent",
    script: "import-hoogwerkers.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-hoogwerker-260413182420.csv")
    ]
  },
  {
    label: "stelling historisch",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-inspectie-stellingmateriaal-260414093135.csv"),
      "--type",
      "stellingmateriaal"
    ]
  },
  {
    label: "stelling recent",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-inspectie-stellingmateriaal-260414090423.csv"),
      "--type",
      "stellingmateriaal"
    ]
  },
  {
    label: "verreiker historisch",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-verreiker-260414092900.csv"),
      "--type",
      "verreiker"
    ]
  },
  {
    label: "verreiker recent",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-verreiker-260414090229.csv"),
      "--type",
      "verreiker"
    ]
  },
  {
    label: "graafmachine historisch",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-graafmachine-260414092832.csv"),
      "--type",
      "graafmachine"
    ]
  },
  {
    label: "graafmachine recent",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-graafmachine-260414090146.csv"),
      "--type",
      "graafmachine"
    ]
  },
  {
    label: "shovel historisch",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-shovel-260414092752.csv"),
      "--type",
      "shovel"
    ]
  },
  {
    label: "shovel recent",
    script: "import-forminator-machines.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-shovel-260414090446.csv"),
      "--type",
      "shovel"
    ]
  },
  {
    label: "batterij historisch",
    script: "import-battery-laders.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-batterij-laders-260414093055.csv")
    ]
  },
  {
    label: "batterij recent 2025",
    script: "import-battery-laders.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-batterij-en-laders-260414090345.csv")
    ]
  },
  {
    label: "batterij recent 2026",
    script: "import-battery-laders.mjs",
    args: [
      "--source",
      path.join(sourceDir, "forminator-keuring-batterij-en-of-laders-260414090536.csv")
    ]
  }
];

function runNodeScript(scriptFile, extraArgs) {
  execFileSync(
    nodeExe,
    [path.join(scriptsDir, scriptFile), ...extraArgs, "--number-map", numberMap],
    {
      cwd,
      stdio: "inherit"
    }
  );
}

function main() {
  for (const step of importPlan) {
    console.log(`\n=== ${step.label} ===`);
    runNodeScript(step.script, step.args);
  }
}

main();
