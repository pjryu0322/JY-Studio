import { describe, expect, it } from "vitest";
import { validatePreviewCaptureTargetUrl } from "@/lib/preview/previewCaptureSecurity";

const ORIGIN = "https://app.example.com";

describe("previewCaptureSecurity", () => {
  it("blocks arbitrary github.io in production without project allowlist", () => {
    const result = validatePreviewCaptureTargetUrl({
      previewUrl: "https://pjryu0322.github.io/my-app/",
      projectId: "p1",
      platformOrigin: ORIGIN,
      isDevelopment: false,
      allowedPreviewUrls: [],
    });
    expect(result.ok).toBe(false);
  });

  it("allows github.io in development", () => {
    const result = validatePreviewCaptureTargetUrl({
      previewUrl: "https://pjryu0322.github.io/my-app/",
      projectId: "p1",
      platformOrigin: ORIGIN,
      isDevelopment: true,
    });
    expect(result.ok).toBe(true);
  });

  it("allows project preview URL in production", () => {
    const previewUrl = "https://my-pages.github.io/demo/";
    const result = validatePreviewCaptureTargetUrl({
      previewUrl,
      projectId: "p1",
      platformOrigin: ORIGIN,
      isDevelopment: false,
      allowedPreviewUrls: [previewUrl],
    });
    expect(result.ok).toBe(true);
  });

  it("blocks http in production for non-github hosts", () => {
    const result = validatePreviewCaptureTargetUrl({
      previewUrl: "http://example.com/preview",
      projectId: "p1",
      platformOrigin: ORIGIN,
      isDevelopment: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("security");
  });

  it("blocks localhost in production", () => {
    const result = validatePreviewCaptureTargetUrl({
      previewUrl: "http://localhost:3000/projects/p1/preview",
      projectId: "p1",
      platformOrigin: "http://localhost:3000",
      isDevelopment: false,
    });
    expect(result.ok).toBe(false);
  });

  it("allows localhost in development when allowlisted", () => {
    const previewUrl = "http://localhost:3000/projects/p1/preview?scope=latest";
    const result = validatePreviewCaptureTargetUrl({
      previewUrl,
      projectId: "p1",
      platformOrigin: "http://localhost:3000",
      isDevelopment: true,
      allowedPreviewUrls: [previewUrl],
    });
    expect(result.ok).toBe(true);
  });

  it("blocks 192.168.x.x", () => {
    const result = validatePreviewCaptureTargetUrl({
      previewUrl: "http://192.168.0.10:3000/foo",
      projectId: "p1",
      platformOrigin: "http://192.168.0.10:3000",
      isDevelopment: false,
    });
    expect(result.ok).toBe(false);
  });
});
