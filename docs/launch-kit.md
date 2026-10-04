# Launch kit — v0.1.2, October 3–4, 2026

Status: internal drafts and submission assets. No community post, directory entry,
or package submission has been published by this work. The native Mac check found
that v0.1.2 runs JSON → YAML but does not open its chain-name prompt. The dialog fix
is local and unreleased. Do not announce reliable native chain saving until a
corrected release is tested. Keep the finished Home-first media and its provenance;
the bridge-backed recording does not prove native persistence.

## Submission assets

| Item | Source |
| --- | --- |
| Official product page | https://play.alsatian.co/software/binturong.htm |
| Repository | https://github.com/alsatianco/binturong |
| Downloads | https://github.com/alsatianco/binturong/releases/latest |
| Install instructions | [README](../README.md#install) |
| Detailed quick start | [User guide](../how_to_use.md#quick-start-format-json-and-save-a-pipeline) |
| Home screenshot | [home.png](assets/home.png) |
| Tool and pipeline screenshots | [json-format.png](assets/json-format.png), [pipeline.png](assets/pipeline.png) |
| Demonstration | [103-second MP4](assets/workflow.mp4), [README GIF](assets/workflow.gif) |
| Social preview | [1280 × 640 PNG](assets/social-preview.png) |
| Synthetic sample and capture context | [Sample](assets/sample.json), [asset provenance](assets/README.md) |
| Release and contributor issue copy | [GitHub presentation](github-presentation.md) |
| Packaging candidates and checks | [Distribution guide](../packaging/README.md) |
| Outcomes and feedback | [Launch log](launch-log.csv), [reporting method](adoption/README.md) |

The new local README, user guide, and media must be pushed before their GitHub file
URLs are used in submissions. The already deployed product page is reachable; use
it for media until then. Do not link unpublished local files as if they were live.

Homebrew command: `brew install --cask alsatianco/tap/binturong`.
Manual Mac CLI: `/Applications/Binturong.app/Contents/MacOS/binturong-cli`.
Windows: v0.1.2 x64 setup EXE (MSI alternative); Linux x86_64: DEB/RPM/AppImage.
Use the latest-release page for download selection and the README for warnings.
Winget, Flatpak, and Snap have no advertised installation command yet.

## Show HN working draft

Candidate title: `Show HN: Binturong – developer tools for macOS, Windows and Linux`

Submission URL: repository or product page with working downloads.

First-comment structure and internal wording draft:

> I'm the maker of Binturong, an MIT-licensed desktop developer toolbox built with
> Tauri, Rust, React, and TypeScript.
>
> [Write your firsthand reason for building it here: the task, the friction, and
> why this approach was useful to you.]
>
> A concrete task to try is formatting a JSON API response and converting it to
> YAML. The app and bundled CLI process that input locally. The command palette
> helps find tools; the pipeline runner shows intermediate outputs.
>
> Current limitations include unsigned publisher builds, manual updates, external
> Tesseract for OCR, and fixed pipeline formatter defaults. The released Mac build
> has a chain-saving dialog problem; a local fix is being validated.
>
> I'd like to learn where installation or first use gets confusing, and which real
> task would make this useful to you again.

Read the current [Show HN rules](https://news.ycombinator.com/showhn.html) and
[HN guidelines](https://news.ycombinator.com/newsguidelines.html) immediately before
posting. Checked October 3: HN requires the author to write their own text and
prohibits generated/AI-edited posts and automated posting. This agent-written draft
is an internal factual brief; write the actual submission and comment yourself.
Arrange your own availability to answer questions; no response cadence has been
promised here.

## Community drafts

These are angle-specific internal drafts, not permission to post. Check each
venue's current rules, showcase threads, flair, and eligibility at submission time.

### Rust / Tauri community

Title: `Binturong: a Tauri developer toolbox with shared desktop and CLI operations`

> Binturong is an MIT-licensed desktop toolbox for formatting and converting data.
> Rust implements the operations and local SQLite storage, while React supplies
> the workspace and pipeline UI. A bundled CLI runs the same operation dispatchers.
> The repository has CLI-equivalence checks and frontend tests; platform builds
> alone do not establish installer or native-webview behavior. A native Mac check
> caught browser prompts failing to open for saved chains, and a local in-app
> dialog replacement is under validation. I'd welcome feedback on that integration
> and on the JSON → YAML workflow. I'm the project's maker.

Link repository, relevant test source, and the dated native validation record.
Do not call it audited or claim architectural novelty.

### macOS app community

Title: `Binturong: local developer utilities for Apple Silicon and Intel Macs`

> Binturong brings JSON formatting, conversions, token inspection, and other small
> developer tasks into a desktop workspace. It is free under MIT and includes a
> CLI. The universal Mac download is available directly or through the Homebrew
> tap. Current builds are ad-hoc signed and unnotarized, so installation can require
> the documented quarantine helper. JSON → YAML runs locally; chain saving in
> v0.1.2 has a native dialog issue with an unreleased fix. I'm the maker and would
> value concrete feedback about installation and finding your first useful tool.

Link product page, Home image, and install guide. Update the chain limitation only
after checking the corrected downloadable build.

### Web development community

Title: `A desktop workflow for formatting JSON and converting it to YAML`

> For a synthetic API response such as
> `{"service":"orders","environment":"local","retries":3}`, Binturong can format
> JSON and convert it to YAML locally, in the UI or through its bundled CLI.
> JWT Debugger also inspects token headers/payloads, but does not verify signatures.
> It is an MIT-licensed desktop app for macOS, Windows x64, and Linux x86_64.
> Browser utilities may be a better fit when installation is inconvenient.
> I'm the maker; feedback about a real task or confusing first-use step would help.

Link a working download and the demo, with its bridge-capture caveat if discussing
saved chains. Use only a permitted project-showcase format.

## Directory description draft

Binturong is a free, MIT-licensed desktop developer toolbox for macOS, Windows x64,
and Linux x86_64. Format code, convert JSON/YAML and other data, inspect tokens,
and use a bundled CLI. Input processing is local; OCR setup uses the network and
requires Tesseract. Current builds have unsigned-publisher installation warnings,
manual updates, and a known Mac chain-saving dialog issue. No store listings are
claimed. Use the Home screenshot and official URLs above.

## FAQ / reply facts

| Question | Prepared answer |
| --- | --- |
| Why instead of another toolbox? | Desktop workspace plus shared CLI operations and compatible pipelines. DevToys, DevUtils, IT-Tools, and CyberChef overlap substantially; choose based on workflow. See the dated [README comparison](../README.md#why-choose-it--tradeoffs). |
| Price and license? | Free, MIT licensed. No account required by the app. Do not promise future maintenance or pricing policy beyond the current license. |
| Is input uploaded? | Tools process locally. OCR installation/language downloads use the network and external links open the browser. No current app analytics integration. See [privacy](privacy.md). |
| Does local mean no stored input? | No. Local history stores up to 20 runs per tool; saved chains include input. Remember last input is separate. History has no recording-off switch. Clear controls and unencrypted storage are documented; the released native confirmation issue needs a fix. |
| JWT verification? | Decoding/inspection only; no signature verification. |
| Pipelines? | Compatible formatter/converter operations with fixed Format defaults, no per-step direction/configuration. v0.1.2 Mac runs the demonstrated conversion but saving needs the dialog fix. |
| Signing and warnings? | Mac ad-hoc signed/unnotarized, Windows without publisher signatures. A package manager does not provide publisher signing. Follow platform install instructions. |
| Updates and packages? | Manual installer or Homebrew upgrade. No automatic updater; winget/Flatpak/Snap candidates are unpublished. |
| What was tested? | See [launch preparation](launch-preparation.md) and [native/install evidence](installation-validation-2026-10-03.md). Media uses a bridge; tests, local native checks, containers, and clean cross-platform installer QA are separate. |
| AI assistance? | Maintainer account pending. This launch preparation used an AI coding agent for verification, documentation, and the local dialog fix; that does not establish how the maintainer built or reviewed the rest of Binturong. |
| Why did you build it? | Firsthand maintainer account pending. Do not invent a development timeline, motivation, or browser-tool privacy incident. |
| Maintenance/support? | GitHub issues and contributions are available. Ask the maintainer for a realistic response cadence before making a promise. |

## Publication handoff

Resolve the native dialog blocker, test the corrected downloadable artifact,
complete clean Windows/Linux and Intel Mac checks, then refresh limitation wording.
Obtain firsthand origin/AI details. Push authorized repository changes before
linking new docs. Upload the social preview in GitHub settings; release editing and
issue labels still need additional token permissions. Keep community/store posting,
account enrollment, and spending as explicit maintainer actions. Record actual URLs
and dates in the launch log after each action; never use a draft filename as a
publication URL.
