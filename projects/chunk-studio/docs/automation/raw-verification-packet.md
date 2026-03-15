# Raw Source Verification Packet (Chunk Studio)

Repository: `pjryu0322/JY-Studio`  
Commit: `777bf07991e7ff32947b40e0d206f0a495182d7c`  
Target scope: `projects/chunk-studio/src/components/workspace`

## Canonical raw URLs (use these exact paths)

- useWorkspaceState.ts  
  https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace/useWorkspaceState.ts

- PageAnalyzerPanel.tsx  
  https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace/PageAnalyzerPanel.tsx

- ChunkOverlayCanvas.tsx  
  https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace/ChunkOverlayCanvas.tsx

- ChunkInspector.tsx  
  https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace/ChunkInspector.tsx

- WorkspacePdfPane.tsx  
  https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace/WorkspacePdfPane.tsx

- PdfSemanticChunkEditor.tsx  
  https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace/PdfSemanticChunkEditor.tsx

## Important check rule

Please verify line counts using the **exact URLs above**.  
Do not omit `projects/chunk-studio/` in path.

## Repro command (PowerShell)

```powershell
$base='https://raw.githubusercontent.com/pjryu0322/JY-Studio/777bf07991e7ff32947b40e0d206f0a495182d7c/projects/chunk-studio/src/components/workspace'
$files=@('useWorkspaceState.ts','PageAnalyzerPanel.tsx','ChunkOverlayCanvas.tsx','ChunkInspector.tsx','WorkspacePdfPane.tsx','PdfSemanticChunkEditor.tsx')
foreach($f in $files){
  $c=(Invoke-WebRequest -Uri "$base/$f" -UseBasicParsing).Content
  "$f`t$(( $c -split \"`n\" ).Length)"
}
```

## Expected direction

These files should appear as normal multiline TS/TSX source (not one-line/minified).
