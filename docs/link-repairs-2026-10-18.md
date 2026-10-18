# Website link repairs — 2026-10-18

Repaired the 37 external URLs returning HTTP 404 in the original audit and one additional replication reference found when the database source inventory was refreshed. Removed unavailable resource-directory entries, updated documentation references, replaced three missing UI illustrations, and converted a Python script mistakenly embedded as an image into a source-code link.

Eight résumé logos are now local SVG files with the upstream Devicon license preserved. The retired duplicate database article URL redirects to its replacement. The build keeps the skip link ahead of navigation and preserves the Oracle game’s page title.

## Validation

- 1,055 HTML files scanned; 90,412 local references checked.
- 0 missing internal targets and 0 missing static anchors.
- 1,815 unique external destinations: 1,809 verified, 0 confirmed missing, 6 still unverified.
- 622 local image files passed image decoding or SVG parsing; 99 external image URLs passed content validation.
- Full build pipeline completed using the source working trees at the commits listed below, followed by the final replication-reference and page-title corrections.
- Python checks: 17 passed (link resolution, Markdown generation/source discovery, page enhancement/idempotence).
- Browser checks: 139 passed across article responsiveness, site navigation, home performance, layout stability, dark mode, tool layout, Oracle and inertia suites.

External verification combines HTTP HEAD/GET checks with read-only GitHub API checks, LeetCode problem metadata, and browser/web fetches for sites that reject the basic HTTP client. Queries are excluded from filesystem lookup, clean URLs resolve to HTML/index files, and preconnect hints are excluded. The link checker reports access restrictions and connection failures separately from confirmed missing destinations.

## Source pull requests

**Merge these source PRs before rebuilding from the default upstream branches.** The generated website snapshot includes their changes; rebuilding against unmerged default branches would restore the old source content.

| Repository | Pull request | Source commit |
| --- | --- | --- |
| Algorithms-And-Data-Structures | [#31](https://github.com/djeada/Algorithms-And-Data-Structures/pull/31) | [f95ae90d](https://github.com/djeada/Algorithms-And-Data-Structures/commit/f95ae90d5f147dc84f95b37890a335766dd0736b) |
| Databases-Notes | [#21](https://github.com/djeada/Databases-Notes/pull/21) | [f01ec987](https://github.com/djeada/Databases-Notes/commit/f01ec98773d797442ac15987045be479f7ca04e7) |
| Frontend-Notes | [#32](https://github.com/djeada/Frontend-Notes/pull/32) | [ee0c2879](https://github.com/djeada/Frontend-Notes/commit/ee0c2879c3cff36472af750a2d10537585ba7fa8) |
| Kurs-Podstaw-Pythona | [#10](https://github.com/djeada/Kurs-Podstaw-Pythona/pull/10) | [6fb5b7b6](https://github.com/djeada/Kurs-Podstaw-Pythona/commit/6fb5b7b6047b69348862b7b5017b594702fa3e3c) |
| Linux-Notes | [#39](https://github.com/djeada/Linux-Notes/pull/39) | [b7b178c9](https://github.com/djeada/Linux-Notes/commit/b7b178c9ee2c29bd9497e6a399ad90ec99d6de50) |
| Parallel-And-Concurrent-Programming | [#32](https://github.com/djeada/Parallel-And-Concurrent-Programming/pull/32) | [8bf0c7b0](https://github.com/djeada/Parallel-And-Concurrent-Programming/commit/8bf0c7b0df1d0fbecafc17674d5e95fa6bb904fe) |
| Standard-of-Iron | [#1606](https://github.com/djeada/Standard-of-Iron/pull/1606) | [6ebb529d](https://github.com/djeada/Standard-of-Iron/commit/6ebb529d141818d43bcc12bf46dfbc0f7d9a63fc) |
| Vtk-Examples | [#36](https://github.com/djeada/Vtk-Examples/pull/36) | [05fd0dff](https://github.com/djeada/Vtk-Examples/commit/05fd0dff6afadf3ff0f17c7023e43c7a723fa519) |

After the source merges, run `python3 scripts/run_all.py` and `python3 scripts/check_links.py --external --json /tmp/link-report.json` from the website repository. The redirect writer runs last so generated article cleanup cannot remove the legacy route.

## Destinations still requiring manual verification

These are access-restricted pages or connection failures, rather than confirmed dead links. They remain unchanged.

- https://pngtree.com/ — HTTP 403.
  - [articles/frontend_notes/13_additional_resources.html](../src/articles/frontend_notes/13_additional_resources.html#L355)
- https://www.behance.net/ — HTTP 403.
  - [articles/frontend_notes/13_additional_resources.html](../src/articles/frontend_notes/13_additional_resources.html#L326)
- https://www.gnu.org/s/coreutils/manual/html_node/shred-invocation.html — Connection failed or timed out.
  - [articles/linux_notes/encryption.html](../src/articles/linux_notes/encryption.html#L1036)
- https://www.gnu.org/software/tar/manual/html_node/Position_002dSensitive-Options.html — Connection failed or timed out.
  - [articles/linux_notes/tar_and_gzip.html](../src/articles/linux_notes/tar_and_gzip.html#L394)
- https://www.linkedin.com/in/adam-djellouli-1bb54619a/ — HTTP 999.
  - [articles/algorithms_and_data_structures/backtracking.html](../src/articles/algorithms_and_data_structures/backtracking.html#L959)
  - [articles/algorithms_and_data_structures/backtracking.html](../src/articles/algorithms_and_data_structures/backtracking.html#L984)
- https://www.vultr.com/ — HTTP 403.
  - [articles/frontend_notes/11_hosting_websites.html](../src/articles/frontend_notes/11_hosting_websites.html#L307)
