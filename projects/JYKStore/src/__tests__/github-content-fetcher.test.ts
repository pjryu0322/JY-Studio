import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchGitHubTextBlob } from "@/lib/github-auto-collect/github-content-fetcher";

describe("github content fetcher", () => {
  it("decodes base64 blob content to utf-8 text", async () => {
    const text = "# Hello GitHub";
    const encoded = Buffer.from(text, "utf8").toString("base64");
    const fetchImpl = async () =>
      new Response(
        JSON.stringify({ content: encoded, encoding: "base64", size: text.length }),
        { status: 200 },
      );

    const result = await fetchGitHubTextBlob({
      owner: "o",
      repo: "r",
      path: "README.md",
      sha: "abc",
      maxFileBytes: 200_000,
      fetchImpl: fetchImpl as typeof fetch,
    });

    assert.equal(result.content, text);
    assert.equal(result.encoding, "utf-8");
    assert.ok(!JSON.stringify(result).includes("Bearer"));
  });

  it("rejects content over maxFileBytes", async () => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ content: "YQ==", encoding: "base64", size: 500_000 }), {
        status: 200,
      });

    await assert.rejects(
      () =>
        fetchGitHubTextBlob({
          owner: "o",
          repo: "r",
          path: "big.txt",
          sha: "abc",
          maxFileBytes: 1000,
          fetchImpl: fetchImpl as typeof fetch,
        }),
    );
  });

  it("rejects binary-like decoded content", async () => {
    const binary = Buffer.from([0, 1, 2, 3, 4, 0, 6, 7, 8, 9]).toString("base64");
    const fetchImpl = async () =>
      new Response(JSON.stringify({ content: binary, encoding: "base64", size: 10 }), {
        status: 200,
      });

    await assert.rejects(
      () =>
        fetchGitHubTextBlob({
          owner: "o",
          repo: "r",
          path: "bin.dat",
          sha: "abc",
          maxFileBytes: 200_000,
          fetchImpl: fetchImpl as typeof fetch,
        }),
    );
  });
});
