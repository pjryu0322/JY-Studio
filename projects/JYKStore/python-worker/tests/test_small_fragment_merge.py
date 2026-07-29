"""P4.2 too-small fragment merge + exact duplicate cleanup."""

from __future__ import annotations

import unittest

from src.small_fragment_merge import (
    dedupe_exact_section_contents,
    is_meaningful_short_unit,
    merge_undersized_fragments,
)


class SmallFragmentMergeTests(unittest.TestCase):
    def test_merges_short_general_fragment_into_adjacent(self):
        sections = [
            {"heading": "Intro", "content": "This is a longer parent section with enough body text."},
            {"heading": "frag", "content": "그리고 이어지는 짧은 조각"},
        ]
        out = merge_undersized_fragments(sections)
        self.assertEqual(len(out), 1)
        self.assertIn("이어지는 짧은 조각", out[0]["content"])
        self.assertEqual(out[0].get("mergeReason"), "undersized_fragment_merged")
        self.assertTrue(out[0].get("autoCorrections"))

    def test_protects_api_signature_and_error(self):
        api = {"heading": "getData", "content": "function getData(id: string): Promise<void>"}
        err = {"heading": "Errors", "content": "error: E_NOT_FOUND"}
        self.assertTrue(is_meaningful_short_unit(api))
        self.assertTrue(is_meaningful_short_unit(err))
        out = merge_undersized_fragments(
            [
                {"heading": "Parent", "content": "Parent body that is long enough to stay put."},
                api,
                err,
            ]
        )
        self.assertEqual(len(out), 3)

    def test_protects_code_blocks(self):
        sections = [
            {"heading": "A", "content": "Parent text for context about the sample."},
            {
                "heading": "B",
                "content": "short",
                "codeBlocks": [{"content": "console.log(1)"}],
            },
        ]
        out = merge_undersized_fragments(sections)
        self.assertEqual(len(out), 2)

    def test_does_not_merge_across_different_parent_paths(self):
        sections = [
            {
                "heading": "A",
                "content": "Parent A body text for a section.",
                "headingPath": "Root > A",
            },
            {
                "heading": "B",
                "content": "그리고 짧은 B",
                "headingPath": "Root > Other > B",
            },
        ]
        out = merge_undersized_fragments(sections)
        self.assertEqual(len(out), 2)

    def test_exact_duplicate_removed_near_duplicate_kept(self):
        sections = [
            {"heading": "One", "content": "Identical body text here."},
            {"heading": "Two", "content": "Identical body text here."},
            {"heading": "Three", "content": "Identical body text here with extra."},
        ]
        out = dedupe_exact_section_contents(sections)
        self.assertEqual(len(out), 2)
        self.assertEqual(out[0]["heading"], "One")
        self.assertEqual(out[1]["heading"], "Three")


if __name__ == "__main__":
    unittest.main()
