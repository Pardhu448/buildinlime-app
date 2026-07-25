# Privacy Policy — intake / inputs

Fill in the **"Your input / edit"** column and the **Open questions** at the bottom, then
hand this back and I'll generate `PRIVACY_POLICY.md` from it. Rows marked 🔲 need your
answer; rows marked ✅ are pre-filled from the app source — just confirm or correct them.

| # | Section | Proposed content (from the code / data-safety doc) | Your input / edit |
|---|---|---|---|
| 1 | **Who (data controller)** | App name: **BuildInLime**. | 🔲 Legal/entity name + country to name as controller |
| 2 | **Contact** | For privacy & deletion requests. | 🔲 Contact email (e.g. privacy@buildinlime.com) |
| 3 | **What you collect** | Email address; photos & videos; documents/files; voice recordings; text messages. On-device: session cookie (secure-store) + local SQLite cache. | ✅ confirm, or add/remove |
| 4 | **Name / profile** | A name/profile exists on the server account (better-auth). | 🔲 Which profile fields exist? Is name required at signup? |
| 5 | **Why (purposes)** | Provide the app (project collaboration: channels, tasks, messages, attachments) and account management/auth. **Not** for advertising; **not** sold. | ✅ confirm "no ads / no selling" |
| 6 | **Who it's shared with (processors)** | Your own server/infra; the OTP **email-delivery provider**; the **file/object storage** provider. No sharing for advertising. | 🔲 Name the providers: hosting =? , email sender =? , object storage =? (e.g. Google Cloud Storage) |
| 7 | **Retention** | How long data is kept. | 🔲 e.g. "kept until the user deletes their account; backups purged after N days" |
| 8 | **Security** | Encrypted in transit (TLS to app.buildinlime.com); access limited to members of a channel; session token in the device secure store. | 🔲 Encrypted at rest? (confirm yes/no) |
| 9 | **User rights & deletion** | How a user accesses, corrects, or deletes their data. | 🔲 Deletion method: in-app "delete account", or email request to whom? Any access/export path? |
| 10 | **Children** | Age policy. | 🔲 Minimum age? Is it "not directed to children under 13/16"? |
| 11 | **Where data is processed** | Server/storage location (matters for GDPR transfers). | 🔲 Hosting region/country |
| 12 | **Permissions rationale** | Microphone → record voice messages (user-initiated); Camera/Photos → attach images/videos to messages & tasks. | ✅ confirm |
| 13 | **Governing law / audience** | Which region's users, to pick GDPR / CCPA / general wording. | 🔲 Primary user region (e.g. India / EU / US / global) |
| 14 | **Effective date** | Date shown on the policy. | 🔲 Date (or "on publish") |

## Open questions (the free-text ones — write as much as you like)

1. **Account deletion** — exactly how can a user delete their account and data today?
   (In-app button? Email to X? Not yet supported → we should state an email request path.)

2. **Data retention** — how long is content (messages, files) and account data kept after
   deletion or inactivity? Any backup retention window?

3. **Sub-processors** — the concrete third parties that touch user data, so we can name
   them: hosting provider, transactional-email provider (OTP codes), object/file storage.

4. **Entity + contact** — the name to publish as the data controller, a contact email, and
   (if you have one) a mailing address/jurisdiction.

5. **Anything else** you want stated (e.g. no third-party analytics/ads — already true today;
   note that crash reporting via Sentry is currently OFF and will be declared if enabled).
