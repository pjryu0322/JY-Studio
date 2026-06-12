import { describe, expect, it } from "vitest";
import { patchMeetingWorkspacePanelForSampleDataPreview } from "@/lib/prototype/meetingWorkspacePreviewSampleDataWiring";

describe("meetingWorkspacePreviewSampleDataWiring", () => {
  it("wires MeetingFilePanel placeholder to sampleMeetingFiles", () => {
    const source = `export function MeetingFilePanel() {
  return <p>업로드된 회의 녹취 파일이 여기에 표시됩니다.</p>;
}`;
    const patched = patchMeetingWorkspacePanelForSampleDataPreview({
      path: "src/components/MeetingFilePanel.tsx",
      sourceUtf8: source,
    });
    expect(patched).toContain("jy-preview-file-list");
    expect(patched).toContain("sampleMeetingFiles");
    expect(patched).toContain("from '../data/sampleData'");
    expect(patched).not.toContain("여기에 표시됩니다");
  });

  it("upgrades legacy ul wiring to v2 presentation", () => {
    const legacy = `import { sampleMeetingFiles } from '../data/sampleData';
export function MeetingFilePanel() {
  return <ul className="sample-meeting-files">{sampleMeetingFiles.map((file) => (<li key={file.id}>{file.name}</li>))}</ul>;
}`;
    const patched = patchMeetingWorkspacePanelForSampleDataPreview({
      path: "src/components/MeetingFilePanel.tsx",
      sourceUtf8: legacy,
    });
    expect(patched).toContain('data-jy-preview-sample="v2"');
    expect(patched).not.toContain('className="sample-meeting-files"');
  });

  it("wires ParticipantPanel placeholder to sampleParticipants", () => {
    const source = `export function ParticipantPanel() {
  return <div>회의 참여자 목록이 여기에 표시됩니다.</div>;
}`;
    const patched = patchMeetingWorkspacePanelForSampleDataPreview({
      path: "src/components/ParticipantPanel.tsx",
      sourceUtf8: source,
    });
    expect(patched).toContain("sampleParticipants");
  });

  it("returns null when no known placeholder", () => {
    const patched = patchMeetingWorkspacePanelForSampleDataPreview({
      path: "src/components/MeetingFilePanel.tsx",
      sourceUtf8: "export const x = 1;",
    });
    expect(patched).toBeNull();
  });
});
