# Adoption reporting

Capture a baseline before public posts and one snapshot each week during the first
month. [The read-only script](../../scripts/report_adoption.py) records UTC time,
repository stars/forks/subscribers, per-asset cumulative release downloads, and
GitHub's traffic/referrer endpoints. It makes no repository changes and adds no
application telemetry.

From the repository root, with Python 3.11+:

```bash
python3 scripts/report_adoption.py
# Optional: private traffic access with an existing credential file:
python3 scripts/report_adoption.py --token-file ~/.secrets/github_token_admin
```

The script also accepts `GH_TOKEN` or `GITHUB_TOKEN`; it never prints or saves their
values. Reports are new timestamped JSON files in [snapshots](snapshots/).
HTTP failures are recorded as unavailable, never as zero. Website visits are
`not_measured`; add a dated export from a measurement system only if one is actually
in use. A token that reads public metadata may still lack traffic permission.

## Baseline — October 3, 2026

See the [baseline snapshot](snapshots/2026-10-03T153431587748Z.json). This was captured
after About settings and two contributor issues were created, before any community
launch. Existing downloads and website activity include preparation checks by the
maintainer/agent; they are not an organic-launch result. Snapshot time and the
traffic API's returned daily dates, rather than this heading, define its windows.

| Baseline measure | Observed value |
| --- | --- |
| Stars / forks / subscribers | 0 / 0 / 0 |
| Views / unique visitors, rolling 14 days | 62 / 5 |
| Clones / unique cloners, rolling 14 days | 538 / 99 |
| v0.1.2 installer-asset downloads, cumulative | 9 across seven assets |
| Website visits | Not measured |
| Firsthand external-user feedback | None recorded |

The installer total excludes `SHA256SUMS` (12) and `allow-binturong.sh` (1).
It includes the preparation DMG downloads and is not a user count.

## Weekly procedure

1. Run the same command. Commit the new snapshot with its capture date.
2. Compare stars and each asset's count with the previous snapshot. Match assets by
   release tag and asset ID; a replaced asset resets its counter. Sum app installers
   separately from `SHA256SUMS` and the quarantine helper. Platform alternatives can
   be downloaded by one person, so their sum does not count unique users.
3. Review daily traffic and [launch log](../launch-log.csv) together. Traffic is a
   rolling 14-day window; do not sum overlapping weekly totals or treat referrer
   rankings as complete attribution. Clones can include automation. Downloads,
   stars, views, and clones do not measure retention.
4. Add installation problems and substantive feedback to [feedback.csv](feedback.csv)
   with a source URL or a consenting tester's anonymized identifier. Record OS,
   architecture, app version, task, observed problem, next action, and follow-up.
   Do not put secrets, private inputs, or identifying personal details in this
   public repository. An empty log means no observations recorded, not proof that
   no problems exist.
5. Ask willing early users after a week whether they still use Binturong and for
   which tasks; record answers and nonresponses separately. Never infer retention
   from a download count.
6. After four weeks, write a short dated decision: observed outcomes, recurring
   friction, strongest useful channel, next improvement, and what remains unknown.

Recheck [GitHub traffic documentation](https://docs.github.com/en/rest/metrics/traffic)
if endpoint access or retention changes. The private traffic capture stores only
aggregate API results. No website analytics setup, user contact, or posting is
performed by this reporting command.
