/**
 * Privacy policy copy for /privacy.
 *
 * Source of truth: the approved DPDP-Act draft (v2.4, effective 25/07/2026).
 * Kept in sync with the Play Data Safety declaration (mobile-app/PLAY_DATA_SAFETY.md):
 * every data category stated here must also be declared there, and vice versa.
 * The account-deletion path (clause 10) matches the in-app flow at /delete-account,
 * and the sub-processor list (clause 6) matches the Account page (clause 7.4).
 */

export type PrivacySection = {
  title: string;
  paragraphs: string[];
};

export const PRIVACY_EFFECTIVE_DATE = "25 July 2026";

export const PRIVACY_VERSION = "1.0";

export const PRIVACY_INTRO =
  "This policy explains what BuildInLime collects, why, the legal basis on which it is processed, and the choices and statutory rights you have. BuildInLime is a construction project-management application operated by DataConscientious LLP and built by Barefoot Programmers (barefootprogrammers.in).";

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: "1. Definitions",
    paragraphs: [
      "1.1 In this policy:",
      "1.1.1 \"DPDP Act\" means the Digital Personal Data Protection Act, 2023, together with the rules made under it as in force from time to time.",
      "1.1.2 \"IT Act\" means the Information Technology Act, 2000, and \"SPDI Rules\" means the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.",
      "1.1.3 \"Personal Data\" has the meaning given to it in section 2(t) of the DPDP Act.",
      "1.1.4 \"Data Fiduciary\", \"Data Principal\", \"Data Processor\" and \"Sub-processor\" carry the meanings given to them under the DPDP Act; the Data Fiduciary in respect of BuildInLime is DataConscientious LLP, and the user of the app is the Data Principal.",
      "1.1.5 \"You\" means the Data Principal — the individual to whom the Personal Data relates — and \"we\", \"us\" or \"our\" means DataConscientious LLP.",
    ],
  },
  {
    title: "2. Who we are",
    paragraphs: [
      "2.1 BuildInLime is a construction project-management application operated by DataConscientious LLP, a limited liability partnership registered with the Registrar of Companies (RoC), Vijayawada, India, with its registered office at 24-24-14, Rajaka Street, Durgapuram, Vijayawada – 520003, Andhra Pradesh, India.",
      "2.2 The application is built by Barefoot Programmers (barefootprogrammers.in). DataConscientious LLP is the Data Fiduciary and is responsible for the Personal Data processed through the app.",
    ],
  },
  {
    title: "3. Legal basis and your consent",
    paragraphs: [
      "3.1 We process your Personal Data on the basis of your consent under section 6 of the DPDP Act. For a limited set of purposes — including account security, prevention of fraud and misuse, and compliance with law — we may also process Personal Data on the basis of the \"legitimate uses\" recognised under section 7 of the DPDP Act.",
      "3.2 By creating an account and using BuildInLime, you consent to the processing of your Personal Data for the purposes described in clause 5.",
      "3.3 Withdrawal of consent. You may withdraw your consent at any time through the Account page in the app or by writing to the Grievance Officer at the address in clause 13. Withdrawal will not affect the lawfulness of any processing carried out before withdrawal. Where withdrawal makes it impossible for us to continue providing the app to you, we will inform you and treat the withdrawal as a request for account deletion under clause 10.",
      "3.4 Language. This policy is published in English. On request to the Grievance Officer, we will endeavour to make it available in any of the languages listed in the Eighth Schedule to the Constitution of India.",
    ],
  },
  {
    title: "4. What we collect",
    paragraphs: [
      "4.1 Account information: your email address, and a name/profile associated with your account.",
      "4.2 Content you create or upload: text messages, tasks, photos and videos, documents and files, and voice recordings — all as part of using the app to collaborate on projects.",
      "4.3 On your device: a session cookie held in secure storage to keep you signed in, and a local database cache (held in an on-device SQLite store) that holds a copy of the data you are allowed to see so the app works offline.",
      "4.4 Technical and log data: IP address, device model, operating-system version, app version, session timestamps and anti-abuse logs, collected for security, diagnostics and to comply with our obligations under law.",
      "4.5 SDKs, analytics and telemetry. The BuildInLime APK does not embed any third-party analytics, advertising, crash-reporting, push-notification or telemetry SDK, and the app code does not collect any advertising identifier or device identifier. Specifically: analytics SDKs — none; crash-reporting SDKs — none; push-notification libraries — none; advertising SDKs or advertising IDs — none; device identifiers collected by app code — none.",
      "4.6 The only third-party libraries present in the APK are functional/framework components necessary for the app to run and to render content, namely: React Native with the Hermes JavaScript engine; Expo modules core; expo-sqlite (local on-device database); react-native-gesture-handler; react-native-reanimated and its worklets runtime; react-native-screens; react-native-svg; react-native-safe-area-context; the Fresco image pipeline (including its WebP, GIF and AVIF decoders); and OkHttp (React Native's bundled HTTP client). None of these libraries are used for tracking, analytics, advertising or profiling.",
      "4.7 Network egress. From the app on your device, network requests are made only to our own backend at app.buildinlime.com. The app does not call any third-party analytics, advertising or tracking endpoint.",
      "4.8 Voice recordings are stored as ordinary media files attached to your messages and tasks. They are not processed for speaker identification or any other biometric purpose.",
    ],
  },
  {
    title: "5. Why we use it",
    paragraphs: [
      "5.1 We use Personal Data:",
      "5.1.1 to provide the app — project collaboration through channels, tasks, messages and attachments — and to manage your account and sign you in;",
      "5.1.2 to keep the service secure, prevent misuse and investigate incidents;",
      "5.1.3 to communicate with you about the service (including sign-in codes and service notices); and",
      "5.1.4 to comply with applicable law.",
      "5.2 We do not use your data for advertising, and we do not sell it. We do not use your data for automated decision-making, profiling, or the training of any artificial-intelligence or machine-learning model.",
    ],
  },
  {
    title: "6. Who it is shared with",
    paragraphs: [
      "6.1 Your data is processed on cloud infrastructure operated on our behalf by our Sub-processors. As at the effective date of this policy, we engage the following Sub-processors:",
      "6.1.1 a cloud infrastructure provider — Google Cloud Platform, operated by Google LLC — which provides application hosting, the primary database and file storage for BuildInLime, with processing carried out in India; and",
      "6.1.2 a transactional email provider — Resend, operated by Resend, Inc. — which delivers sign-in one-time password (OTP) codes to Data Principals, and which delivers the contact-form and account-deletion-request emails generated from within the app. Resend processes the email addresses of the sender and recipient(s) and any message text entered into those forms. Resend operates from the US East Region (United States of America).",
      "6.1.3 No other Sub-processors are engaged as at the effective date of this policy.",
      "6.2 Each Sub-processor is engaged on terms that limit it to processing Personal Data only for the specified purpose and on our instructions, and that impose appropriate confidentiality and security obligations. In respect of Resend, Inc., its publicly available privacy policy (accessible at https://resend.com/legal/privacy-policy) sets out the confidentiality, security, sub-processing and international-transfer commitments that apply to Personal Data of Indian Data Principals processed through the Resend service.",
      "6.3 We may also disclose Personal Data where we are required to do so by law, by an order of a court or a competent authority, or to protect the rights, safety and property of DataConscientious LLP or others.",
      "6.4 We do not share your data with anyone for advertising.",
    ],
  },
  {
    title: "7. Where your data is stored and processed",
    paragraphs: [
      "7.1 BuildInLime's primary hosting, database and file storage — operated on Google Cloud Platform — are located in India.",
      "7.2 Cross-border transfer to Resend (United States). Personal Data comprising your email address and the message text you enter into a sign-in, contact-form or account-deletion-request flow is transmitted to Resend, Inc. for processing in the US East Region solely for the purpose of delivering that email. This transfer is undertaken in accordance with section 16 of the DPDP Act, and will be discontinued or re-routed if the Central Government of India, by notification under that section, restricts transfers of Personal Data to the United States or to Resend, Inc. The confidentiality and security commitments applicable to this transfer are set out in Resend, Inc.'s privacy policy at https://resend.com/legal/privacy-policy.",
      "7.3 If, in future, any Sub-processor processes Personal Data in a location other than the one identified in clause 6, we will update this policy and, where required, obtain a fresh consent before the change takes effect.",
      "7.4 A current list of Sub-processors, together with their processing locations, is maintained in the app at app.buildinlime.com/account and updated when it changes.",
    ],
  },
  {
    title: "8. Security",
    paragraphs: [
      "8.1 We follow \"reasonable security practices and procedures\" within the meaning of section 43A of the IT Act read with Rule 8 of the SPDI Rules. In particular:",
      "8.1.1 data is encrypted in transit using TLS and at rest using industry-standard encryption;",
      "8.1.2 access to the content in a channel is limited to the members of that channel and enforced on the server for every request;",
      "8.1.3 access by DataConscientious LLP personnel is on a need-to-know, audit-logged basis;",
      "8.1.4 your session token is held in your device's secure store; and",
      "8.1.5 backups are encrypted and retained for 30 days, after which they are overwritten.",
      "8.2 No system is impregnable. We do not warrant that our safeguards will prevent every unauthorised access, but we commit to the standards above and to the notification obligation in clause 9.",
    ],
  },
  {
    title: "9. Data breach notification",
    paragraphs: [
      "9.1 In the event of a personal data breach affecting your Personal Data, we will intimate you and the Data Protection Board of India in the form, manner and within the timelines prescribed under section 8(6) of the DPDP Act and the rules made under it.",
      "9.2 Where the incident is a \"cyber security incident\" of a kind reportable under the CERT-In directions dated 28 April 2022, we will additionally report it to the Indian Computer Emergency Response Team (CERT-In) within the six-hour timeline prescribed.",
    ],
  },
  {
    title: "10. Your rights as a Data Principal",
    paragraphs: [
      "10.1 Under the DPDP Act, you have the following rights in respect of your Personal Data:",
      "10.1.1 Right of access — to obtain a summary of the Personal Data being processed and the processing activities undertaken in respect of it;",
      "10.1.2 Right to correction, completion and updating — to have inaccurate or misleading data corrected, incomplete data completed, and data brought up to date;",
      "10.1.3 Right to erasure — to have your Personal Data deleted, subject to the retention exceptions in clause 11;",
      "10.1.4 Right of nomination — to nominate another individual to exercise these rights on your behalf in the event of your death or incapacity; and",
      "10.1.5 Right of grievance redressal — to have any grievance about the processing of your Personal Data addressed by us in the manner set out in clause 13, and, if not resolved, escalated to the Data Protection Board of India.",
      "10.2 You may exercise any of these rights through the Account page in the app or by writing to the Grievance Officer at the contact details in clause 13. You can also download a copy of your data as part of a deletion request through the Account page.",
      "10.3 Where the request is for deletion of your account, your account and its associated data will be deleted from our systems within 30 days of the request, subject to clause 11.",
    ],
  },
  {
    title: "11. Data retention",
    paragraphs: [
      "11.1 We keep your Personal Data for as long as your account is active. After you request deletion, your data is retained for up to 30 days and then removed from our systems.",
      "11.2 Notwithstanding clause 11.1, we may retain limited Personal Data for longer where we are required to do so under applicable law, including: books of account and related records under the Limited Liability Partnership Act, 2008; tax records under the Income-tax Act, 1961; records under the Prevention of Money-laundering Act, 2002, where applicable; and records reasonably required to establish, exercise or defend legal claims, or to comply with an order of a court or competent authority.",
      "11.3 Encrypted backups may persist for up to 30 days after live-data deletion, after which they are overwritten.",
    ],
  },
  {
    title: "12. Children",
    paragraphs: [
      "12.1 BuildInLime is intended for users aged 18 years and above.",
      "12.2 We do not knowingly collect Personal Data from children (persons below 18). If we become aware that we have received Personal Data of a child without verifiable parental consent, we will delete that data as soon as reasonably practicable.",
      "12.3 We do not undertake tracking, behavioural monitoring, or targeted advertising directed at children, and where processing of a child's data is ever undertaken, it will be only with verifiable parental consent in the manner prescribed under section 9 of the DPDP Act.",
    ],
  },
  {
    title: "13. Grievance Officer",
    paragraphs: [
      "13.1 In accordance with section 8(9) of the DPDP Act and Rule 3 of the SPDI Rules, the Grievance Officer for BuildInLime is: Name — Parthasarathi E; Designation — Associate; Postal address — DataConscientious LLP, 24-24-14, Rajaka Street, Durgapuram, Vijayawada – 520003, Andhra Pradesh, India; Email — support@buildinlime.com; Telephone — 0866-2956826, available Monday to Friday, 3:00 PM to 5:00 PM (IST), excluding public holidays.",
      "13.2 We will acknowledge a grievance within 48 hours of receipt and endeavour to resolve it within 30 days (or such shorter period as may be prescribed under the DPDP Rules once notified).",
      "13.3 If your grievance is not resolved to your satisfaction, you may complain to the Data Protection Board of India established under the DPDP Act.",
    ],
  },
  {
    title: "14. Permissions",
    paragraphs: [
      "14.1 The app requests the microphone only to record voice messages you choose to send, and the camera and photo library only to attach images and videos to your messages and tasks. These are used only when you initiate the action.",
      "14.2 You may withdraw any of these permissions at any time through your device's operating-system settings; some features of the app may not function fully without them.",
    ],
  },
  {
    title: "15. Community data",
    paragraphs: [
      "15.1 We believe the information a community generates belongs to that community.",
      "15.2 As at the effective date of this policy, we do not contribute any user data to the Mozilla Data Collective or to any similar third-party data commons, research corpus or model-training arrangement. If, in future, we decide to participate in any such arrangement, we will update this policy and obtain your fresh, separate, opt-in consent — distinct from your consent to use the app — before any contribution begins.",
    ],
  },
  {
    title: "16. Google Play Data Safety alignment",
    paragraphs: [
      "16.1 The disclosures in this policy correspond to the declarations we have made in the Google Play Data Safety section for BuildInLime. Where any inconsistency arises between the two, this policy governs, and we will update the Data Safety declaration to match.",
      "16.2 This policy is available from the app's Play Store listing and from within the app under Settings → Privacy.",
    ],
  },
  {
    title: "17. Changes to this policy",
    paragraphs: [
      "17.1 We may update this policy from time to time. Where a change is material, we will notify you through the app and by email to your registered address, and, where required by law, seek a fresh consent.",
      "17.2 We maintain a change-log of prior versions. The version and effective date at the head of this policy identify the current version; prior versions are available on request to the Grievance Officer.",
    ],
  },
  {
    title: "18. Governing law and jurisdiction",
    paragraphs: [
      "18.1 This policy and the operation of BuildInLime are governed by the laws of India.",
      "18.2 Subject to your statutory right to complain to the Data Protection Board of India, the courts at Vijayawada, Andhra Pradesh shall have exclusive jurisdiction over any dispute arising out of or in connection with this policy.",
    ],
  },
  {
    title: "19. Contact",
    paragraphs: [
      "For any question about this policy or your data, contact the Grievance Officer at the details in clause 13, or write to support@buildinlime.com.",
      "© 2026 DataConscientious LLP. All rights reserved. BuildInLime is built by Barefoot Programmers (barefootprogrammers.in).",
    ],
  },
];
