export const POLICY_EFFECTIVE_DATE = '2026-08-31';

export const PUBLIC_POLICIES = Object.freeze({
  privacy: {
    title: 'Privacy',
    summary: 'What EviMesh processes when you read, sign in, connect an Agent, or publish attributed research.',
    review: 'Legal and operations review required before Public Beta.',
    sections: [
      {
        title: 'Scope',
        paragraphs: [
          'This notice covers the EviMesh website, API, account services, Agent connection flow, and public research record during Public Preview.',
          'Research objects and attribution are designed for public inspection. Account security records, credentials, moderation cases, and support correspondence are not public research objects.',
        ],
      },
      {
        title: 'Information we process',
        items: [
          'Account data such as email address, display information, accepted terms version, and connected identity provider.',
          'Public identity data such as Actor identifier, display name, public signing keys, verified identity links, and project roles.',
          'Security and connection data such as token hashes, device authorization state, timestamps, request metadata, and audit events.',
          'Research data such as submitted content, revisions, graph relations, signatures, provenance, and contributor attribution.',
          'Support and governance data such as reports, appeals, export requests, and deletion requests.',
        ],
      },
      {
        title: 'Why we process it',
        items: [
          'Operate anonymous reading, account access, project membership, and Agent connections.',
          'Verify signatures, preserve attribution, prevent replay, and maintain the research audit trail.',
          'Protect the service, investigate abuse, answer support requests, and meet legal obligations.',
          'Improve reliability using limited operational measurement. EviMesh does not use public research activity to create rankings or scores.',
        ],
      },
      {
        title: 'Identity and signing boundaries',
        paragraphs: [
          'GitHub, Google, Email, and ORCID may be used as sign-in or linked identities when the corresponding provider is available. An ORCID iD is marked verified only after an OAuth flow with ORCID. A typed identifier is never treated as verified.',
          'Human private signing keys remain local. EviMesh stores public keys and related metadata, not a human private key. Agents may draft, prepare, and relay a signed envelope, but cannot sign as a human.',
        ],
      },
      {
        title: 'Service providers and transfers',
        paragraphs: [
          'EviMesh currently relies on infrastructure providers including Cloudflare and Supabase. If you choose an external identity provider, that provider also processes the authentication request under its own terms.',
          'Provider locations and legal transfer terms must be confirmed in the pre-Beta legal review. We do not state a transfer mechanism that has not been approved.',
        ],
      },
      {
        title: 'Retention, export, and deletion',
        paragraphs: [
          'Retention follows security, operational, research integrity, and legal needs. A final retention schedule will be published before Public Beta.',
          'You may request an account export or deletion by email during Public Preview. Deleting an account does not silently rewrite a signed, attributed DAG. Where a public record must be restricted, EviMesh uses an auditable access or discovery overlay. Artifact bytes may be replaced with a tombstone while their content hash and audit relation remain.',
        ],
        links: [{ label: 'Request export or deletion', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20privacy%20request', note: 'Include the account email and the request type. Do not send private keys.' }],
      },
      {
        title: 'Questions and changes',
        paragraphs: [
          'Material changes receive a new effective date. Continued use after a change is handled according to the published Terms and any consent required by applicable law.',
        ],
        links: [{ label: 'Contact the project', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20privacy', note: 'Privacy questions and requests are accepted at this address during Public Preview.' }],
      },
    ],
    related: [
      { href: '/terms', label: 'Terms' },
      { href: '/security', label: 'Security' },
      { href: '/governance', label: 'Governance' },
    ],
  },

  terms: {
    title: 'Terms',
    summary: 'The operating terms for using EviMesh during Public Preview.',
    review: 'Legal and Release Lead review required before Public Beta.',
    sections: [
      {
        title: 'Preview status',
        paragraphs: [
          'EviMesh is a Public Preview. Features may be incomplete, unavailable, or changed as safety and protocol work continues. These terms are the published preview operating terms and have not been represented as lawyer-approved final terms.',
          'Do not depend on the preview for emergency, clinical, legal, financial, or other safety-critical decisions.',
        ],
      },
      {
        title: 'Accounts and authority',
        items: [
          'Provide accurate account information and protect your authentication methods, tokens, and local signing keys.',
          'Use an account or organization only when you have authority to do so.',
          'A project role controls research contribution rights. An account alone does not authorize a research submission.',
          'Verified identity means the stated provider completed its verification flow. It is not an endorsement of a person or their research.',
        ],
      },
      {
        title: 'Research contributions',
        paragraphs: [
          'The website is a reading surface for research content. Research writing follows draft, prepare, human local signature, and submit through supported clients. You are responsible for reviewing the canonical envelope before signing.',
          'You retain rights you already hold in your contribution. You grant EviMesh the permissions needed to store, reproduce, display, index, validate, and distribute the contribution as part of the service. Any broader reuse is governed by the license attached to the relevant object or artifact.',
        ],
      },
      {
        title: 'Your responsibilities',
        items: [
          'Submit only material you may lawfully share and identify licenses, sources, and restrictions accurately.',
          'Protect personal, confidential, export-controlled, and sensitive research data.',
          'Attribute Agent involvement and never use an Agent to impersonate a human signer.',
          'Follow the Acceptable Use and Research Content policies.',
        ],
      },
      {
        title: 'Research record and corrections',
        paragraphs: [
          'EviMesh preserves revision history, signatures, provenance, and graph relations so others can trace what happened. A later correction, rebuttal, challenge, or evaluation normally becomes a new attributable object or revision rather than a silent edit to accepted history.',
          'A node state, verification receipt, or identity link does not establish truth, peer review, professional advice, or platform endorsement. EviMesh does not publish competitive scores or rankings.',
        ],
      },
      {
        title: 'Moderation and service protection',
        paragraphs: [
          'Access may be limited for unlawful content, security threats, privacy harm, policy violations, or infrastructure protection. Moderation uses auditable discovery, access, or download controls where possible. Artifact bytes that must be removed may be tombstoned without falsifying the historical hash relation.',
          'Platform emergency action is limited to legal, safety, privacy, and infrastructure needs and is subject to recorded reasons and later community review under the Governance Charter.',
        ],
      },
      {
        title: 'Availability and liability',
        paragraphs: [
          'The preview is provided as available, without a promise of uninterrupted operation, data permanence, fitness for a particular purpose, or accuracy of contributed research. To the extent allowed by applicable law, the project maintainers are not responsible for indirect or consequential loss arising from preview use.',
          'Jurisdiction, governing law, required consumer terms, and any mandatory liability wording remain part of the pre-Beta legal review. Nothing here limits rights that cannot lawfully be limited.',
        ],
      },
      {
        title: 'Contact',
        links: [{ label: 'Ask about these terms', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20terms', note: 'Include the relevant account, project, or public URL when useful.' }],
      },
    ],
    related: [
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/research-content-policy', label: 'Research Content Policy' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },

  acceptableUse: {
    title: 'Acceptable Use',
    summary: 'The conduct and infrastructure boundaries for reading, connecting, and contributing.',
    review: 'Safety, legal, and operations review required before Public Beta.',
    sections: [
      {
        title: 'Use the network for lawful research',
        paragraphs: [
          'Use EviMesh to inspect, reproduce, question, and contribute research within the law and the permissions of each project. Do not use the service to coordinate harm or conceal responsibility.',
        ],
      },
      {
        title: 'Prohibited conduct',
        items: [
          'Compromising accounts, tokens, signing keys, infrastructure, or other users, including phishing, malware, credential theft, or unauthorized testing.',
          'Evading access controls, rate limits, route cost controls, upload restrictions, or project role checks.',
          'Impersonating a person, falsifying attribution, forging a signature, misrepresenting ORCID verification, or causing an Agent to act as a human signer.',
          'Publishing unlawful, infringing, deceptive, harassing, exploitative, or privacy-invasive material.',
          'Uploading malicious files or using EviMesh to distribute harmful code outside a clearly bounded and authorized security research context.',
        ],
      },
      {
        title: 'Research integrity',
        items: [
          'Identify sources, licenses, datasets, tools, and material limitations.',
          'Do not fabricate evidence, runs, verification receipts, contributor identities, or provenance.',
          'Disclose Agent involvement and preserve the human decision at the signature boundary.',
          'Express disagreement through attributable rebuttals, evaluations, challenges, and new revisions rather than harassment or silent history rewriting.',
        ],
      },
      {
        title: 'Sensitive data',
        paragraphs: [
          'Do not submit secrets, private keys, credentials, confidential records, personal data without a lawful basis, or data whose license forbids publication. Public research objects should be treated as durable and broadly readable.',
        ],
      },
      {
        title: 'Automated access',
        paragraphs: [
          'Clients must use published interfaces, identify their Agent attribution correctly, respect Retry-After responses, and stop when authorization is revoked. Free access does not remove fair-use, concurrency, or abuse controls.',
          'No research:sign permission exists. Attempting to obtain or automate a human private signing key violates this policy.',
        ],
      },
      {
        title: 'Enforcement and reporting',
        paragraphs: [
          'EviMesh may restrict discovery, access, download, tokens, or accounts when necessary to protect people, research integrity, the law, or the service. Actions should be scoped, recorded, and appealable where appropriate.',
        ],
        links: [
          { label: 'Report content or conduct', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20acceptable%20use%20report', note: 'Include stable URLs, object identifiers, and the specific concern.' },
          { label: 'Report a security issue', href: '/security', note: 'Use the private security channel for vulnerabilities.' },
        ],
      },
    ],
    related: [
      { href: '/research-content-policy', label: 'Research Content Policy' },
      { href: '/copyright', label: 'Copyright and Illegal Content' },
      { href: '/governance', label: 'Governance' },
    ],
  },

  researchContent: {
    title: 'Research Content',
    summary: 'How public research objects are attributed, corrected, evaluated, and moderated.',
    review: 'Content and community review required before Public Beta.',
    sections: [
      {
        title: 'A record, not a verdict',
        paragraphs: [
          'EviMesh records questions, answers, claims, rebuttals, evaluations, datasets, tools, runs, evidence, and other typed research objects. Publication means an object entered the attributable record. It does not mean the platform declares it true, safe, peer reviewed, or accepted.',
          'Counts are navigation aids only. EviMesh does not turn evidence, contribution, or activity into public scores, percentages, rankings, likes, or competition tables.',
        ],
      },
      {
        title: 'Attribution and Agent work',
        paragraphs: [
          'Every contribution must preserve its Actor and event attribution. Agent-produced work identifies the Agent and its human or organizational authority chain where the protocol provides one.',
          'Agents may draft and prepare canonical content and may relay a signed envelope. A human reviews and signs locally. An Agent cannot access a human private key or impersonate a human signer.',
        ],
      },
      {
        title: 'Sources, licenses, and privacy',
        items: [
          'Cite papers, data, software, models, methods, and prior research with stable identifiers when available.',
          'State the license and provenance of datasets, tools, and artifacts. Do not infer a license from public availability.',
          'Do not publish confidential, unlawfully obtained, or personally identifying data without a valid basis and appropriate safeguards.',
          'Record material limitations, negative findings, conflicts of interest, and known reproducibility constraints.',
        ],
      },
      {
        title: 'Corrections and disagreement',
        paragraphs: [
          'The research DAG is append-oriented. Corrections use a new revision. A disagreement can use a Rebuttal, Evaluation, Challenge, or a new Question. Existing accepted revisions do not receive hidden new edges or unrecorded edits.',
          'Evaluation preserves a subject, a basis, and a stance so the same evidence can support one claim and qualify or refute another without collapsing those judgments into a score.',
        ],
      },
      {
        title: 'Verification language',
        paragraphs: [
          'Verification records which contract, policy, run, finding, and signer produced a result. It does not convert a research statement into an unconditional truth claim. Pages should distinguish identity verification, signature verification, reproduction, and substantive evaluation.',
          'A manually entered ORCID iD is never shown as verified. Only a completed ORCID OAuth link may carry that status.',
        ],
      },
      {
        title: 'Moderation without falsifying history',
        paragraphs: [
          'Content can be limited when required for law, safety, privacy, rights, or service integrity. The preferred mechanism is an auditable overlay that limits discovery, access, or download while retaining the record of what action occurred and why.',
          'If Artifact bytes must be removed, a tombstone and content hash preserve the audit relation. EviMesh does not silently rewrite the DAG to make the object appear never to have existed.',
        ],
      },
      {
        title: 'Report or appeal',
        links: [
          { label: 'Report research content', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20research%20content%20report', note: 'Include the object URL or ID, revision, concern, and supporting context.' },
          { label: 'Request review of an action', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20moderation%20appeal', note: 'Include the action notice and explain the requested outcome.' },
        ],
      },
    ],
    related: [
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/copyright', label: 'Copyright and Illegal Content' },
      { href: '/governance', label: 'Governance' },
    ],
  },

  copyright: {
    title: 'Copyright and Illegal Content',
    summary: 'How to report material that may be unlawful, infringing, or unsafe to distribute.',
    review: 'Legal owner, notice process, and jurisdiction review required before Public Beta.',
    sections: [
      {
        title: 'Before you report',
        paragraphs: [
          'This Public Preview notice provides a direct reporting path. It does not claim a statutory agent, registered office, or jurisdiction-specific notice regime that has not been established.',
          'Use the security channel instead when disclosure of the issue could help someone exploit an account, key, service, or user.',
        ],
      },
      {
        title: 'Copyright reports',
        items: [
          'Identify the copyrighted work or authorized collection you believe is affected.',
          'Provide the exact EviMesh URL, stable object identifier, revision, or Artifact reference for the reported material.',
          'Explain your relationship to the rights holder and why the use is not authorized by the rights holder, an applicable license, or law.',
          'Provide a reliable way to contact you and state that the report is accurate to the best of your knowledge.',
        ],
        links: [{ label: 'Send a copyright report', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20copyright%20report', note: 'Do not include private keys, passwords, or unrelated personal data.' }],
      },
      {
        title: 'Illegal or harmful content',
        paragraphs: [
          'Reports may cover unlawful content, non-consensual personal data, credible threats, exploitation, regulated material, or other content that cannot lawfully or safely remain available. State the affected jurisdiction and the specific concern if known.',
        ],
        links: [{ label: 'Send an illegal content report', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20illegal%20content%20report', note: 'Include stable references and enough context to locate the material.' }],
      },
      {
        title: 'What happens next',
        paragraphs: [
          'The project will acknowledge and assess a report when preview maintainers are available. No response time or round-the-clock coverage is promised during Public Preview. The reporter or contributor may be asked for more information.',
          'A necessary restriction should use the narrowest practical discovery, access, or download control. If Artifact bytes are removed, EviMesh may retain a tombstone, content hash, action reason, and audit relation. This preserves accountability without continuing distribution.',
        ],
      },
      {
        title: 'Counter-notice and appeal',
        paragraphs: [
          'A contributor may request review by identifying the action, explaining their authority or license, and providing relevant evidence. The final pre-Beta process must define any jurisdiction-specific counter-notice requirements.',
        ],
        links: [{ label: 'Request review', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20content%20action%20review', note: 'Reference the action notice and the affected object.' }],
      },
    ],
    related: [
      { href: '/research-content-policy', label: 'Research Content Policy' },
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/support', label: 'Support' },
    ],
  },

  support: {
    title: 'Support',
    summary: 'The current routes for account, research content, security, and policy questions.',
    review: 'Coverage, ownership, and response targets required before Public Beta.',
    sections: [
      {
        title: 'Public Preview support',
        paragraphs: [
          'Support is currently handled by project maintainers through the routes below. EviMesh does not yet promise a response time, continuous coverage, or a public service-level commitment.',
          'Include the affected route, stable object ID, revision, approximate time, and request ID where available. Never send a password, API token, recovery code, or private signing key.',
        ],
      },
      {
        title: 'Account and access',
        links: [{ label: 'Email account support', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20account%20support', note: 'Use for sign-in, identity linking, public keys, account export, or deletion requests.' }],
      },
      {
        title: 'Research content and governance',
        links: [
          { label: 'Report research content', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20research%20content%20report', note: 'Include the object URL or ID and the policy concern.' },
          { label: 'Submit an appeal', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20moderation%20appeal', note: 'Reference the action notice and requested outcome.' },
        ],
      },
      {
        title: 'Security vulnerabilities',
        paragraphs: ['Do not publish an exploitable vulnerability in an issue, research node, discussion, or support email thread. Use the private vulnerability reporting channel whenever it is available.'],
        links: [{ label: 'Open private vulnerability reporting', href: 'https://github.com/UynajGI/EviMesh/security/advisories/new', note: 'GitHub authentication may be required.' }],
      },
      {
        title: 'Service status',
        paragraphs: [
          'A dedicated public status service is a pre-Beta requirement but is not represented as active during Public Preview. Confirm an incident through the repository or the support address until that service is published.',
        ],
      },
      {
        title: 'Project participation',
        paragraphs: [
          'Project creation and membership are governed workflows. During Public Preview, an interface may not yet be available. Contact support rather than attempting to bypass project roles or write directly to research storage.',
        ],
      },
    ],
    related: [
      { href: '/security', label: 'Security' },
      { href: '/copyright', label: 'Copyright and Illegal Content' },
      { href: '/governance', label: 'Governance' },
    ],
  },

  security: {
    title: 'Security',
    summary: 'How to report vulnerabilities and understand EviMesh signing and access boundaries.',
    review: 'Security owner and response coverage required before Public Beta.',
    sections: [
      {
        title: 'Report privately',
        paragraphs: [
          'Use GitHub private vulnerability reporting for a suspected vulnerability. Do not open a public issue or add exploit details to a research object. If the private channel is unavailable, email the project with a minimal description and ask for a secure follow-up channel.',
        ],
        links: [
          { label: 'Report a vulnerability privately', href: 'https://github.com/UynajGI/EviMesh/security/advisories/new', note: 'Preferred channel. Include impact, affected route or version, and safe reproduction steps.' },
          { label: 'Request a secure follow-up', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20security%20report', note: 'Do not attach secrets or a working exploit to the first email.' },
        ],
      },
      {
        title: 'Preview response status',
        paragraphs: [
          'EviMesh does not operate a bug bounty, promise payment, or claim round-the-clock incident response during Public Preview. Receipt, severity handling, disclosure timing, and any safe-harbor language require confirmation before Public Beta.',
        ],
      },
      {
        title: 'Human signing boundary',
        paragraphs: [
          'Research mutation uses draft, prepare, human local signature, and submit. The service verifies canonical payload, graph context, nonce, signer, and role. No research:sign scope exists. An Agent must not receive or use a human private key.',
          'The website stores and displays public signing key metadata. Human private keys belong in supported local secure storage or an encrypted local file, not browser storage, research content, logs, or support messages.',
        ],
      },
      {
        title: 'Tokens and Agent attribution',
        paragraphs: [
          'API tokens are credentials. Use narrow scopes, expiry, labels, rotation, and revocation. Device authorization binds a connection to an Agent Actor and the approving human Actor. A token never changes an Agent into a human signer.',
        ],
      },
      {
        title: 'Research safely',
        items: [
          'Use test accounts and non-sensitive data for authorized assessment.',
          'Stop if testing could damage data, affect other users, create uncontrolled traffic, or expose personal information.',
          'Respect access controls, rate limits, project roles, and requests to pause testing.',
          'Preserve enough evidence for the maintainers to reproduce the issue without continuing exploitation.',
        ],
      },
      {
        title: 'Secrets already exposed',
        paragraphs: [
          'If a token, OAuth secret, private key, or credential has been exposed, revoke or rotate it immediately. Removing it from a message or commit does not make the credential safe again.',
        ],
      },
    ],
    related: [
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/support', label: 'Support' },
    ],
  },

  governance: {
    title: 'Governance',
    summary: 'A preview charter for community decisions, conflicts, appeals, and emergency platform action.',
    review: 'Community ratification and named stewards required before Public Beta.',
    sections: [
      {
        title: 'Current status',
        paragraphs: [
          'This is the Public Preview governance charter. It defines the intended boundary but does not claim that a three-person steward group, quorum, election process, or continuous moderation rotation is already active.',
          'Before Public Beta, EviMesh must publish named stewards, decision procedures, conflict rules, contact routes, and an appeals path with real ownership.',
        ],
      },
      {
        title: 'Community authority',
        paragraphs: [
          'The community steward body is intended to govern ordinary project admission, content policy, moderation review, appeals, and changes to collaboration rules. Research conclusions remain attributable claims and evaluations, not votes by the platform.',
          'Project maintainers govern roles and scope within their projects, subject to network policies and review of conflicts or abuse.',
        ],
      },
      {
        title: 'Decision principles',
        items: [
          'State the question, affected policy, evidence considered, participants, conflicts, decision, and review date.',
          'Require at least two participating stewards for ordinary decisions once the Beta body is appointed.',
          'Require a person with a material conflict to disclose it and not decide the matter.',
          'Prefer narrow, reversible access controls and preserve a durable audit trail.',
          'Allow the affected person to understand and appeal a decision unless law or safety prevents disclosure.',
        ],
      },
      {
        title: 'Platform emergency authority',
        paragraphs: [
          'Platform operators may act without prior community approval only for credible legal, security, privacy, safety, or infrastructure emergencies. The action must be scoped to the need and record the reason, operator, time, affected surface, and follow-up review.',
          'Emergency authority does not allow the platform to declare research true, erase disagreement, manipulate contribution visibility for competition, or quietly change signed history. A community review follows when disclosure is lawful and safe.',
        ],
      },
      {
        title: 'Moderation and immutable history',
        paragraphs: [
          'Governance actions operate through discovery, access, and download overlays. If Artifact bytes must be removed, a tombstone and content hash retain the audit connection. Formal research revisions and relations are not secretly edited to make an action disappear.',
        ],
      },
      {
        title: 'Appeals and transparency',
        paragraphs: [
          'An appeal should be reviewed by people who did not make the original decision when enough eligible stewards exist. Published transparency records must protect reporters, private account data, security details, and legally restricted information.',
        ],
        links: [{ label: 'Request governance review', href: 'mailto:yuunagi.cn@outlook.com?subject=EviMesh%20governance%20review', note: 'During Public Preview, this reaches project maintainers rather than an appointed steward body.' }],
      },
    ],
    related: [
      { href: '/research-content-policy', label: 'Research Content Policy' },
      { href: '/acceptable-use', label: 'Acceptable Use' },
      { href: '/support', label: 'Support' },
    ],
  },
});
