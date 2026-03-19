# JYOrchestration 초기 폴더 구조 생성 스크립트
# 파일명 예시: create-jyorchestration-structure.ps1

$root = "C:\project\JY-Studio\projects\JYOrchestration"

$directories = @(
    "$root\apps",
    "$root\apps\web",
    "$root\apps\web\app",
    "$root\apps\web\components",
    "$root\apps\web\features",
    "$root\apps\web\features\project",
    "$root\apps\web\features\project-spec",
    "$root\apps\web\features\feature-spec",
    "$root\apps\web\features\task",
    "$root\apps\web\features\execution",
    "$root\apps\web\features\monitoring",
    "$root\apps\web\lib",
    "$root\apps\web\hooks",
    "$root\apps\web\styles",

    "$root\apps\api",
    "$root\apps\api\src",
    "$root\apps\api\src\modules",
    "$root\apps\api\src\controllers",
    "$root\apps\api\src\services",
    "$root\apps\api\src\validators",
    "$root\apps\api\src\jobs",

    "$root\packages",
    "$root\packages\db",
    "$root\packages\db\migrations",
    "$root\packages\db\seed",

    "$root\packages\domain",
    "$root\packages\domain\project",
    "$root\packages\domain\project-spec",
    "$root\packages\domain\feature",
    "$root\packages\domain\task",
    "$root\packages\domain\policy",
    "$root\packages\domain\run",

    "$root\packages\parser",
    "$root\packages\parser\project-spec",
    "$root\packages\parser\feature-spec",
    "$root\packages\parser\rule-extractor",

    "$root\packages\planner",
    "$root\packages\planner\task-generator",
    "$root\packages\planner\dependency-builder",
    "$root\packages\planner\plan-adjuster",

    "$root\packages\executor",
    "$root\packages\executor\prompt-builder",
    "$root\packages\executor\cursor-adapter",
    "$root\packages\executor\result-collector",

    "$root\packages\validator",
    "$root\packages\validator\policy-validator",
    "$root\packages\validator\git-validator",
    "$root\packages\validator\structure-validator",
    "$root\packages\validator\report-builder",

    "$root\packages\git",
    "$root\packages\git\diff-collector",
    "$root\packages\git\commit-parser",
    "$root\packages\git\repo-manager",

    "$root\packages\ai",
    "$root\packages\ai\prompt-templates",
    "$root\packages\ai\openai-client",
    "$root\packages\ai\task-generator-ai",

    "$root\packages\runtime",
    "$root\packages\runtime\task-runner",
    "$root\packages\runtime\state-machine",
    "$root\packages\runtime\retry-manager",
    "$root\packages\runtime\scheduler",

    "$root\packages\shared",
    "$root\packages\shared\types",
    "$root\packages\shared\constants",
    "$root\packages\shared\utils",
    "$root\packages\shared\logger",

    "$root\infra",
    "$root\infra\docker",
    "$root\infra\scripts",
    "$root\infra\env",

    "$root\docs",
    "$root\docs\project-spec",
    "$root\docs\feature-spec",
    "$root\docs\architecture",
    "$root\docs\prompts",

    "$root\.jy",
    "$root\.jy\prompts",
    "$root\.jy\runs",
    "$root\.jy\reports",
    "$root\.jy\temp"
)

$files = @(
    "$root\package.json",
    "$root\pnpm-workspace.yaml",
    "$root\tsconfig.json",
    "$root\README.md",

    "$root\apps\api\package.json",
    "$root\packages\db\schema.prisma"
)

Write-Host "Creating directory structure under: $root" -ForegroundColor Cyan

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "Already exists: $dir" -ForegroundColor Yellow
    }
}

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        New-Item -ItemType File -Path $file -Force | Out-Null
        Write-Host "Created file: $file" -ForegroundColor Green
    } else {
        Write-Host "Already exists: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nDone." -ForegroundColor Cyan