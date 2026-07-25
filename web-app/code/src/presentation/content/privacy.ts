/**
 * Privacy policy copy for /privacy.
 *
 * Kept in sync with the Play Data Safety declaration (mobile-app/PLAY_DATA_SAFETY.md):
 * every data category stated here must also be declared there, and vice versa.
 * The account-deletion path described under "Your rights and data deletion"
 * matches the in-app flow at /delete-account.
 */

export type PrivacySection = {
  title: string;
  paragraphs: string[];
};

export const PRIVACY_EFFECTIVE_DATE = "25 July 2026";

export const PRIVACY_INTRO =
  "This policy explains what BuildInLime collects, why, and the choices you have. BuildInLime is operated by DataConscientious LLP and built by Barefoot Programmers (barefootprogrammers.in).";

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    title: "Who we are",
    paragraphs: [
      "BuildInLime is a construction project-management application operated by DataConscientious LLP, registered with the Registrar of Companies (RoC), Vijayawada, India. The application is built by Barefoot Programmers (barefootprogrammers.in).",
      "DataConscientious LLP is the data controller. For any privacy or data-deletion request, contact us at support@buildinlime.com.",
    ],
  },
  {
    title: "What we collect",
    paragraphs: [
      "Account information: your email address, and a name/profile associated with your account.",
      "Content you create or upload: text messages, tasks, photos and videos, documents and files, and voice recordings — all as part of using the app to collaborate on projects.",
      "On your device: a session cookie held in secure storage to keep you signed in, and a local database cache that holds a copy of the data you are allowed to see so the app works offline.",
    ],
  },
  {
    title: "Why we use it",
    paragraphs: [
      "To provide the app — project collaboration through channels, tasks, messages and attachments — and to manage your account and sign you in.",
      "We do not use your data for advertising, and we do not sell it.",
    ],
  },
  {
    title: "Who it is shared with",
    paragraphs: [
      "Your data is processed on our own server infrastructure. We use a transactional email provider to deliver sign-in codes and messages, and a file-storage provider to hold uploaded files. These providers process data only to provide their service to us.",
      "We do not share your data with anyone for advertising.",
    ],
  },
  {
    title: "Security",
    paragraphs: [
      "Data is encrypted in transit using TLS. Access to the content in a channel is limited to the members of that channel, enforced on the server for every request. Your session token is held in your device's secure store.",
    ],
  },
  {
    title: "Your rights and data deletion",
    paragraphs: [
      "You can request deletion of your account and its data from the Account page in the app, which also lets you download a copy of your data as part of the request. When you submit the request, it is sent to our team at support@buildinlime.com and processed manually.",
      "Your account and its associated data are deleted from our systems within 30 days of the request. You can also reach us at support@buildinlime.com to access, correct, or delete your data.",
    ],
  },
  {
    title: "Data retention",
    paragraphs: [
      "We keep your data for as long as your account is active. After you request deletion, your data is retained for up to 30 days and then removed from our systems.",
    ],
  },
  {
    title: "Data sovereignty",
    paragraphs: [
      "We believe the information a community generates belongs to that community. In support of this, we are members of the Mozilla Data Collective, and you can request removal of your data from the collective as part of your deletion request.",
    ],
  },
  {
    title: "Permissions",
    paragraphs: [
      "The app requests the microphone only to record voice messages you choose to send, and the camera and photo library only to attach images and videos to your messages and tasks. These are used only when you initiate the action.",
    ],
  },
  {
    title: "Governing law and contact",
    paragraphs: [
      "This policy and the operation of BuildInLime are governed by the laws of India, with DataConscientious LLP registered under the Registrar of Companies (RoC), Vijayawada. For any question about this policy or your data, contact support@buildinlime.com.",
    ],
  },
];
