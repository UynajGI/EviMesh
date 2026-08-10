# M13.7-A09 prototype concept and navigation test plan

## Status and boundary

This is a moderated concept/navigation test plan for the fixture-only route `/prototypes/m13-7-a`. It tests comprehension of proposed labels, information architecture, and research language; it does not test authentication, identity linking, credentials, Agent connectivity, accessibility conformance, production performance, or any live data behavior.

The prototype is illustrative. It contains local fixture copy and must never be represented as a working product or as evidence that an underlying workflow is available.

## Recruitment and consent guardrails

- Recruit target users who regularly read, assess, reproduce, verify, or coordinate research evidence. Do not recruit minors or people whose participation requires disclosing confidential research material.
- Obtain informed consent before recording notes, audio, video, or screen activity. Explain the study purpose, approximate duration, what is collected, voluntary participation, withdrawal, and how notes will be de-identified.
- Do not collect credentials, API keys, tokens, private links, unpublished research, health information, or other sensitive personal data. Ask participants to use the supplied fixture only.
- Store only consented, minimised research notes in the approved study location. Keep participant identity separate from findings. Do not put participant data in this repository.
- Stop the session if a participant appears uncomfortable, shares sensitive material, or asks to withdraw. Do not pressure participants, infer expertise from identity, or promise product access.

## Session format

Use a moderator and note-taker where possible. Start by stating: “This is an early illustrative prototype, not a live system. We are testing the design, not you. Please think aloud; you may skip any question or stop at any time.” Avoid teaching the desired path before each task. Record observable navigation, participant wording, confusion, and unprompted expectations; do not convert guesses into outcomes.

## Tasks and observation prompts

1. **Anonymous landing:** “You have arrived without an account. What do you think this product helps you do, and where would you go to understand a research record?” Probe only after the attempt: “What did you expect to find there?”
2. **Sign-in intent:** “You want to continue with an existing identity. Find the sign-in path and explain what you think each option means.” Ask whether the prototype makes clear that typed identity text is not verification.
3. **Signed-in Home:** “You return to research you follow. Find what needs your attention and explain why it is worth inspecting.” Check whether attention is understood as a reading priority, not a judgment of truth.
4. **Research workspace:** “Open the research context for the change. Show where you would understand the claim, sources, checks/challenges, and currently usable snapshot.” Listen for natural understanding of Argument, Evidence, Verification, and Frontier.
5. **Account Settings:** “Where would you manage your public profile, linked identities, connection access, and notifications? Explain what should remain separate.”
6. **Agent Connect:** “You want a CLI, MCP client, or SDK to read this record. Where do you start, what should the first read verify, and what must not be included in a handoff?”
7. **Keyboard path:** “Using only the keyboard, move between the top prototype scenes and tell us which scene is active.” Observe focus visibility, arrow-key movement, Home/End behavior, and whether the active panel is understandable.

## Severity rubric

| Severity | Definition | Example threshold |
| --- | --- | --- |
| Critical | A participant cannot safely proceed, or the concept invites a harmful security/provenance interpretation. | Believes a handoff should include a credential, or treats a score as research truth. |
| High | A core task is blocked or repeatedly misdirected without moderator help. | Cannot locate research context, Account, or Agent connection purpose. |
| Medium | The task completes with substantial uncertainty, detour, or misleading expectation. | Cannot distinguish Verification from Evidence after reading the workspace. |
| Low | A local clarity, label, or affordance issue that does not block the task. | A path label is unclear but participants recover unaided. |

Record severity only after reviewing evidence across sessions. Do not calculate success rates, timings, or aggregate outcomes until consented sessions actually exist.
