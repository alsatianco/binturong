# Binturong: visibility and adoption to-do

Goal: help more developers discover, try, keep using, and recommend Binturong. Stars are useful feedback, but downloads, returning users' feedback, and contributions matter too.

Prepared October 3, 2026. Consolidates the three reviews into one prioritized plan. The initial consolidation did not independently re-read the repository; the preparation and follow-up work below now records verified results. Checkmarks indicate completed work, not planned work or drafts awaiting publication. Mixed tasks are split so partial completion remains visible.

**Priorities:** P0 = before broad promotion; P1 = launch and first follow-up; P2 = later, when evidence justifies the effort. External review queues can run alongside local preparation. Signing and package-store acceptance should not become an indefinite launch blocker.

**Recommended order:** L1–L5 → E1 → L6–L7 and E2 in parallel → E3 → E4 → E5–E7. Start with a strong README, one convincing demo, and a working installation path; expand from there.

## 1. Work in external-platform UIs

This section covers account settings, submissions, publishing, community participation, and monitoring. Prepare the files and drafts in Section 2 first. Some submission steps can also be completed through a CLI or pull request.

### E1. GitHub presentation — P0

- [x] Prepare About description, canonical URL, topics, release copy, and scoped issue drafts in [GitHub presentation](docs/github-presentation.md) and [launch preparation](docs/launch-preparation.md#github-presentation-copy). Publication remains pending below.
- [x] Apply the repository's **About** settings through the API and verify the public values. Add a short description that communicates the benefit and platforms. Use the positioning chosen in L1.
- [x] Set the website URL to a working canonical page. If the website is not ready, remove the broken link until it is fixed.
- [x] Add a focused set of accurate topics, such as `developer-tools`, `devtools`, `tauri`, `rust`, `offline`, `productivity`, and `cross-platform`. Add tool-specific topics only when useful; avoid keyword stuffing.
- [ ] Upload the custom social-preview image prepared in L2. Check that the app name and UI remain readable at a small size.
- [ ] Publish a clear latest release: supported operating systems and architectures, recommended download per platform, changes, and known installation limitations. Link to the installation guide.
- [x] Create approachable issues with scope and acceptance criteria after checking for duplicates: [#1](https://github.com/alsatianco/binturong/issues/1), [#2](https://github.com/alsatianco/binturong/issues/2).
- [ ] Apply their prepared `good first issue` labels; GitHub returned HTTP 403 for label writes with every available token.
- [x] Check the current public repository while signed out: HTTP 200, About/homepage/topic links and the latest-release download link are visible.
- [ ] Recheck the complete first impression after publishing the local README/media/docs and release copy, and ask a fresh visitor to find a download within roughly ten seconds.

**Done when:** GitHub, the website, and the release page give a consistent first impression and all prominent links work.

### E2. Distribution and signing accounts — P1; start early

- [ ] Submit the tested Windows package to **winget** using the current contribution process. Track review feedback until the package is accepted and installable. A manifest in the project repository is not a published package.
- [ ] Submit the tested Linux package to **Flathub** if it is a good fit. Choose one additional Linux distribution channel first; maintain it before expanding.
- [ ] Treat the **Snap Store** as optional follow-up unless users specifically request it. Publish only after confinement and integration behavior are tested.
- [ ] Keep the existing **Homebrew tap** current. Consider a main Homebrew cask submission later if the project meets the current acceptance requirements.
- [ ] Review **SignPath Foundation** eligibility and apply if appropriate. Include the required project, release, privacy, and signing-policy information. Acceptance depends on its assessment, including verifiable project reputation; automated CI alone does not guarantee approval. [S2]
- [ ] Decide whether to fund **Apple Developer Program** membership for macOS signing and notarization. Standard enrollment is USD 99 per membership year, with local pricing and limited fee-waiver eligibility. This is a useful adoption investment if macOS users are a priority. [S3]
- [ ] After acceptance or signing is live, update the public installation instructions and verify the exact commands users will copy.

**Dependency:** L5 provides tested packages, release assets, and signing integration. Do not advertise a store or signing status before it is available.

### E3. Small feedback round — P0

- [ ] Ask 3–5 developers who have not used the app to try one real task on their own machines. Seek practical feedback, not stars or coordinated votes.
- [ ] Observe where they hesitate: understanding the pitch, choosing an installer, OS warnings, finding a tool, or using a pipeline.
- [ ] Ask: “What would make you use this again?” and “What would you use instead?” Record their own words.
- [ ] Fix recurring installation or first-use problems before the main launch. Do not wait until every suggestion is implemented.

### E4. Launch on Hacker News, then selected communities — P1

- [ ] Read the current [Show HN guidelines](https://news.ycombinator.com/showhn.html) and [HN guidelines](https://news.ycombinator.com/newsguidelines.html) immediately before posting. Share something people can actually try. [S1]
- [ ] Submit a **Show HN** with a plain, accurate title. Candidate: `Show HN: Binturong – offline developer tools for macOS, Windows and Linux`. Add the verified tool count only if it improves the title.
- [ ] Use the first comment prepared in L7: why you built it, a concrete workflow, what you think is useful, current limitations, and an invitation to try it. State your role as the maker.
- [ ] Reserve several hours to answer questions, reproduce problems, and respond calmly to criticism. Explain AI assistance honestly if asked; point to specific engineering decisions and evidence.
- [ ] Do not ask friends to upvote or comment, buy votes, or arrange engagement. HN explicitly prohibits soliciting votes or comments. [S1]
- [ ] If the submission gets little attention, review the presentation and feedback. Do not automatically repost the same launch or present every minor release as another Show HN; check current guidance before a later submission. [S1]
- [ ] Choose **two or three** relevant Reddit or community destinations. Read current self-promotion rules, flair requirements, and designated showcase threads before submitting. Ask moderators when eligibility is unclear.

| Candidate community | Angle to prepare | Condition |
| --- | --- | --- |
| r/rust or a Tauri community | Architecture, desktop integration, measured tradeoffs | Include real technical substance; follow the venue's showcase rules |
| r/macapps | Everyday workflow, UI, installation experience | Be explicit about current signing status |
| r/webdev | JSON/JWT/encoding workflow and demo | Use the current permitted showcase format or schedule |
| An open-source community | Local processing, contribution model, user benefit | Verify that project promotion is allowed |

- [ ] Stagger these posts over approximately 1–2 weeks, adjusting to community schedules and your availability. Incorporate early feedback before the next post. Avoid identical cross-posts.
- [ ] Share one useful workflow on your existing professional or developer social account, if you have an audience there. Link to the app and explain your connection to it.

**Success signal:** people try it, ask useful questions, report real problems, or describe a task it solves. A front-page appearance or GitHub Trending placement is a possible outcome, not a controllable milestone.

### E5. Durable discovery and Google — P1

- [ ] Create or claim an **AlternativeTo** listing with accurate platforms, license, screenshots, official links, and relevant alternatives such as DevToys, DevUtils, IT-Tools, or CyberChef. Do not solicit fake reviews.
- [ ] Submit a focused PR to **awesome-tauri**, after checking its inclusion criteria and avoiding duplicate entries.
- [ ] Submit a worthwhile release or technical article to **This Week in Rust**, using its current submission route. Lead with what Rust readers would find interesting.
- [ ] Add the deployed website to **Google Search Console** and verify ownership. You can request indexing for a site you control, not for the GitHub repository page. [S4]
- [ ] Submit the sitemap prepared in L6 and use URL Inspection for the homepage and a few important pages. A crawl request does not guarantee indexing or ranking; repeatedly requesting it will not accelerate the process. [S4, S5]
- [ ] Check indexing and search queries after the site has had time to be crawled. Improve pages based on actual queries and user needs.
- [ ] Consider Product Hunt, dev.to, Lobsters, and additional directories only after the first launch and fixes. Pick a venue because its audience fits; follow membership and submission rules. There is no need to launch everywhere.

### E6. Community follow-through — ongoing

- [ ] During launch, aim to acknowledge new issues within one working day when practical. State a realistic response cadence rather than promising round-the-clock support.
- [ ] Turn repeated questions into documentation and recurring failures into focused issues.
- [ ] Publish small, useful releases with readable notes and credit contributors. Announce a concrete improvement only where updates are welcome.
- [ ] Thank contributors and guide first-time contributors through their initial issue or PR.
- [ ] Ask for a GitHub star subtly after delivering value. Avoid pop-ups, repeated nags, star swaps, and bought stars.

### E7. Review results — weekly during the first month

- [x] Record a dated baseline and repeatable reporting method: [snapshot and procedure](docs/adoption/README.md). Website visits remain unmeasured; installation and user feedback have a manual log.
- [ ] Capture weekly follow-up snapshots and substantive user feedback during the first month.
- [x] Create [launch log](docs/launch-log.csv) and record the applied GitHub URLs/date; drafts and blocked edits are labeled.
- [ ] Add actual community launch URLs/dates when published; interpret downloads and stars without treating them as retention.
- [ ] Ask willing early users whether they still use the app and for which tasks. Do not add intrusive telemetry just to measure popularity.
- [ ] After four weeks, choose the next effort from evidence: clearer positioning, easier installation, a requested workflow, or another relevant audience.

## 2. Work that can be done locally

This section covers repository edits, docs, assets, packaging, tests, website implementation, and drafts. Publishing and account actions belong in Section 1.

### L1. Verify the pitch and choose a memorable workflow — P0

- [x] Verify the current release's tool count, supported platforms, CLI availability, pipeline operations, batch mode, clipboard behavior, and network-dependent features. Resolve the conflicting “60+”, “130+”, and “133+” counts in the reviews before publishing any number.
- [x] Choose one main promise. Suggested direction: **“Everyday developer tools, together on your desktop.”** Explain local processing and reusable workflows directly below it, using verified behavior.
- [x] Use tool breadth as supporting evidence. Lead the demo with a task users recognize, such as decoding nested data and formatting the result in a saved pipeline.
- [ ] Confirm the exact sequence works in the released build. Native v0.1.2 Mac conversion passed, but Save as new chain fails; the local fix passes save/restart/CRUD checks and still needs release. Do not promise automatic tool opening if clipboard detection only suggests a tool; do not show decompression or JSONPath stages unless supported.
- [x] Prepare a short, fair answer to “Why use this instead of DevToys, IT-Tools, DevUtils, or CyberChef?” Compare specific workflows, desktop integration, CLI access, and limitations against current versions. CyberChef already has composable recipes; pipelines alone are not a unique category claim.
- [x] Omit unsupported claims such as “10 MB”, “fastest”, “completely private”, or a specific development timeline. Measure and qualify size/performance claims if they are worth using.

### L2. Produce a small visual asset set — P0

- [x] Capture one clear screenshot showing the app doing useful work, using synthetic sample data.
- [x] Record a readable demo of the signature workflow, holding each action for at least 5–10 seconds as requested. Start close to the action; make the input, steps, and result visible.
- [x] Export an optimized GIF for the README and an MP4 for communities or the website. Keep a static screenshot fallback so the page loads quickly and remains understandable without animation.
- [x] Create a social-preview image with the app name, mascot, a short benefit, and a legible UI crop. The mascot supports recognition; the UI shows what people are getting.
- [x] Put the reusable assets in a predictable location such as `docs/assets/`. Add alt text and check readability at normal page width and on mobile.

### L3. Rewrite the README around trying the product — P0

- [x] Make the opening screen contain: name, one-line pitch, screenshot/demo, clear download links, and a compact statement of platforms, license, and local-processing behavior.
- [x] Use this order for the rest: installation → three useful workflows → selected features → why choose it / tradeoffs → privacy and limitations → documentation and contributing links.
- [x] Show representative tools and link to the full catalog. Avoid making visitors read a 130-item list before seeing the app.
- [x] Give the exact verified install command for each published package channel. Clearly distinguish “available now” from “planned”.
- [x] Keep brief warnings that affect installation visible next to the relevant download.
- [x] Move remaining detailed CI design and release-engineering material to supporting docs. Preserve development, testing, and build commands in README.md as required by AGENTS.md.
- [x] Link a short quick start that gets a user to a successful result within about a minute after installation.
- [x] Add one unobtrusive star request near the bottom, tied to usefulness.
- [x] Check every README link/asset, desktop/mobile local Markdown render, and commands against scripts/configuration; safe macOS CLI/build/test commands ran. Platform install commands still need their separate native QA. See [dated evidence](docs/launch-preparation.md#follow-up-readme-and-documentation-checks).

### L4. Curate docs and make trust claims precise — P0

- [x] Create or improve `CONTRIBUTING.md`: setup, development commands, meaningful tests, PR expectations, and a small “how to add a tool” example.
- [x] Separate user help, contributor docs, and release/signing documentation. Add a short docs index.
- [x] Review retained planning/validation material: dated evidence and design records already have separate sections in the docs hub. The hub already separates current instructions from historical records; no relocation was needed for this targeted cleanup.
- [x] Keep security reporting, privacy information, and relevant signing information easy for users to find. They should not be buried solely in contributor instructions.
- [x] Document what processing stays local, any network-enabled tools or downloads, update checks, telemetry if present, and clipboard/history retention and deletion behavior. Check the implementation before making guarantees.
- [ ] Prepare a candid description of AI assistance, if used: what it helped with and what you personally designed, reviewed, and validated. Link to actual tests or benchmarks without claiming an audit that did not happen.
- [x] Add a concise, maintainable comparison only after checking competitors. Include where another tool may be a better choice; date claims that may change.

### L5. Reduce installation and first-use friction — P0/P1

- [x] Remove the old local v0.1.0 app and its app data recoverably, install the checksum-verified v0.1.2 macOS release, and launch its native Home screen. Verify its bundled CLI version and JSON formatting. See [local reinstall evidence](docs/launch-preparation.md#follow-up-home-first-media-and-local-reinstall).
- [ ] Test the released installers on clean supported environments or with external testers. Cover install, first launch, one core task, update where supported, and uninstall.
- [x] Check published release OS/architecture labels, the Homebrew cask's version/URL/hash and exact install command, and the installed macOS bundled CLI. A fresh Homebrew install has not been tested.
- [x] Check manual macOS bundled CLI discovery and its missing-Tesseract error; fetch/verify the current Homebrew cask without replacing the app.
- [ ] Test clean package-manager CLI linking/discovery, missing WebView2/FUSE/OCR setup, and recovery on each supported platform.
- [x] Explain current unsigned-build warnings accurately. A Homebrew tap or winget listing is a distribution channel, not a substitute for publisher signing or notarization.
- [x] Prepare v0.1.2 winget and selected Flatpak repack candidates with verified download hashes, metadata, and update/validation instructions. Winget official schemas and Flatpak static sources/XML checks pass.
- [ ] Run WinGet validation/install tests and Flatpak builder/AppStream/sandbox QA; prepare the offline source-build inputs required for an open-source Flathub submission. Static checks are not package acceptance.
- [ ] Integrate macOS signing/notarization and Windows signing after the required accounts are available. Verify the downloaded release artifact, not only a local development build.
- [x] Document Home/search/command-palette navigation and a synthetic quick-start sample; native Mac palette navigation and the two-step conversion were exercised.
- [x] Fix native chain dialogs and history-clear confirmation locally, with tests and native persistence/CRUD evidence.
- [ ] Release the dialog fix, verify the downloaded artifact, and complete L1’s released-build saved-chain check.
- [x] Document entered-text detection, history retention/deletion and the separate Remember last input setting; source clear confirmations now work in native checks. The release caveat remains visible in the privacy guide.

**Launch minimum:** a working download for every advertised platform, honest installation guidance, and a reliable demonstrated workflow. Store approvals and paid signing can proceed alongside a modest initial launch.

### L6. Fix the website and prepare search discovery — P0/P1

- [x] Check the reported website 404. Fix hosting/routing or correct the README URL; test the public homepage and direct documentation links.
- [x] Build or simplify the landing page around the same promise, demo, downloads, and limitations as the README. A small, fast page is enough.
- [x] Set descriptive page titles, meta descriptions, canonical URLs, favicon, and social-sharing metadata. Include “Binturong developer tools” so searchers can distinguish the app from the animal.
- [x] Ensure useful page text is crawlable, important pages are not accidentally blocked or marked `noindex`, and downloads are easy to reach.
- [x] Generate a sitemap and add a robots.txt sitemap reference. Deploy these before the Search Console tasks in E5.
- [ ] Later, write 2–3 useful pages around actual workflows: decoding a JWT locally, batch conversion, or a saved decoding pipeline. Explain limitations such as decoding versus signature verification. Avoid mass-producing thin SEO pages.
- [ ] **Optional P2:** assess whether the existing frontend-only mode can support a small browser demo without substantial engineering. Clearly label unavailable desktop features, use synthetic examples, and verify data handling. Ship it only if it makes trying the app meaningfully easier; a good video is sufficient for the first launch.

### L7. Prepare a launch kit — P1

- [x] Draft the Show HN title and first comment, two or three community-specific posts, and a short directory description. Leave nothing dependent on an unverified feature or package approval.
- [ ] Write the origin story from your actual experience. Do not adopt an invented motivation or claim that all browser tools upload data; many process it locally.
- [x] Omit the optional JSONFormatter/CodeBeautify incident from launch drafts; no dates/figures or third-party privacy claim were invented. Verify original research first if it is added later.
- [x] Prepare the factual FAQ in [launch kit](docs/launch-kit.md); AI/origin and support commitments are explicitly pending firsthand input.
- [ ] Fill in the maintainer’s personal AI-assistance account and response cadence.
- [x] Assemble the screenshot, demo, official URLs, and exact install instructions in one place so submissions stay consistent.
- [x] Create a simple launch log with date, channel, URL, outcome, useful feedback, and next action.

### L8. Maintain momentum without expanding scope blindly — ongoing

- [ ] Prioritize issues reported by new users and improvements to the most-used workflows. Pause tool-count expansion unless there is a clear need.
- [ ] Write release notes around outcomes: what users can now do, which problem was fixed, and any compatibility changes.
- [ ] Update screenshots, counts, install commands, and comparisons when releases make them stale.
- [ ] Keep contribution instructions workable and create small, well-scoped issues from real needs.
- [ ] Revisit new package channels, a hosted demo, or additional launch venues only after the initial results justify their maintenance cost.

## Progress — October 3, 2026

Completed the first local preparation batch: verified v0.1.2's 134-tool registry,
created Home-first screenshots and a slower GIF/MP4 walkthrough, rewrote
the README, added a checked quick start and contributor/privacy/security guides,
and prepared GitHub presentation copy. See [launch preparation](docs/launch-preparation.md)
for evidence and [GitHub drafts](docs/github-presentation.md) for pending API actions.

Captures use the release frontend with real CLI outputs and an in-memory bridge;
they do not establish native chain persistence or cross-platform installer QA.
The old v0.1.0 app and its data were moved to Trash for recovery. The checksum-verified
v0.1.2 release was installed in `/Applications/Binturong.app`; its native Home
screen and bundled CLI were checked. Homebrew metadata and commands were checked,
but a fresh Homebrew install was not performed. Checkmarks indicate the preparation
and local checks described here; store acceptance, signing, external feedback,
and broader native release testing remain separate.

The website source is `../gen-web/content/software/binturong.md`, with canonical
`.htm` and a compatible `.html` page. Initial website commit `1f55eb1` and Home-first
media update `d04262f` were pushed; both GitHub Pages deployments succeeded.
Both public URLs returned HTTP 200. Home is the lead screenshot and video poster;
the current demo lasts 103 seconds with 5–10-second action/result pauses. Published
pages and updated media matched the generated files; favicon, sitemap, and robots.txt
were verified during the initial deployment. During the initial preparation, no token
was accessible through CLI, environment,
or the configured credential helper. The follow-up below used the credential files
you identified. Binturong changes remain committed locally. Earlier website-only
publication was authorized separately; the current continuation authorizes no push.

## Continuation — October 3–4, 2026

Completed README engineering cleanup/link checks, native macOS conversion testing,
a local chain/history dialog fix (74 UI tests and native save/restart/CRUD checks),
checksum-verified winget/Flatpak candidate preparation, internal launch drafts/FAQ,
a consolidated asset index/log, and an authenticated adoption baseline/reporting
script. [Installation evidence](docs/installation-validation-2026-10-03.md),
[launch kit](docs/launch-kit.md), and [metrics procedure](docs/adoption/README.md)
record the exact scope and limitations. The installed v0.1.2 app, Home-first media,
and unrelated `../gen-web` changes were preserved.

Using the supplied `~/.secrets` files without exposing values, About settings were
applied and verified; issues #1/#2 were created after an empty duplicate check.
All three tokens returned HTTP 403 for release edits and explicit label writes;
those steps remain open. Social preview upload and a final signed-out review of
new repository content await publication/access. The original release changelog
was preserved. No repository push, community post, package submission, account
enrollment, or spending occurred.

The released native Mac chain prompt failed; source now saves/restores chains and
supports confirmed history clearing, but the fix is unreleased. Clean Windows,
Linux desktop, Intel Mac, package-manager install/update/uninstall, Flatpak source
build/sandbox QA, signing accounts, firsthand origin/AI details, external testers,
and community publication remain open. The optional privacy-incident narrative
was omitted; no unverified story was added. The generated HN draft is an internal
brief: current HN rules require the maintainer to write their actual text.

## Practical launch schedule

| Stage | Focus | Exit condition |
| --- | --- | --- |
| Preparation | Verify claims, README, assets, working links, install checks, GitHub settings | A stranger can understand the app and successfully try it |
| Small feedback round | 3–5 fresh users; fix repeated blockers | Main demo and installation path work reliably |
| Launch | One Show HN; stay available | Questions answered and important problems recorded |
| Following 1–2 weeks | Tailored community posts, package submissions, directories | Early feedback incorporated before further promotion |
| First-month review | Compare channels and user feedback | Choose the next improvement based on evidence |

Do not treat the first launch as a single irreversible chance. Presentation matters, but useful updates, better distribution, and continued responsiveness create further opportunities. Avoid spending weeks on new features, broad ad campaigns, or attempts to engineer GitHub Trending before learning why people do or do not keep using the app.

## References for platform-dependent tasks

Checked October 3, 2026; recheck requirements when submitting.

- **[S1]** [Show HN guidelines](https://news.ycombinator.com/showhn.html) and [HN guidelines](https://news.ycombinator.com/newsguidelines.html).
- **[S2]** [SignPath Foundation conditions](https://signpath.org/terms).
- **[S3]** [Apple Developer Program enrollment](https://developer.apple.com/programs/enroll/) and [fee-waiver eligibility](https://developer.apple.com/help/account/membership/fee-waivers).
- **[S4]** [Google: request recrawling and indexing](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
- **[S5]** [Google: build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
