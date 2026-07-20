/**
 * What the two clients can actually do, grouped for /features.
 *
 * Written against the shipping code rather than the roadmap: a feature only
 * appears here if a user can reach it in the UI today. Where web and mobile
 * differ, `platform` says which one has it and `note` says what the other is
 * missing — the alternative is a page that promises parity we don't have.
 *
 * Deliberately absent, because they are stubs or unbuilt: global search, the
 * notifications bell, custom views, push notifications, in-app camera and voice
 * recording, message editing, and role-based permissions.
 */

export type Platform = "both" | "web" | "mobile";

export type Feature = {
  name: string;
  description: string;
  platform: Platform;
  /** How the clients differ, where they do. */
  note?: string;
};

export type FeatureGroup = {
  title: string;
  description: string;
  features: Feature[];
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  both: "Web & mobile",
  web: "Web",
  mobile: "Mobile",
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: "Structure",
    description:
      "Every project is a hierarchy — project, BuildUnit, channel — so a drawing, a bill and a site photograph can all point at the same thing",
    features: [
      {
        name: "Projects and BuildUnits",
        description:
          "Break a build into the units that get built and signed off separately — a foundation, a room, a roof. Everything else hangs off them.",
        platform: "both",
        note: "Created on web; mobile browses the hierarchy rather than editing it.",
      },
      {
        name: "Seven fixed channels per BuildUnit",
        description:
          "Finance, Requirements, Design, Materials, Tools, Execution and Experimentation. The set is fixed on purpose, so the same aspect of a build is always in the same place across every project.",
        platform: "both",
        note: "Opened on web; visible on both.",
      },
      {
        name: "Per-channel membership",
        description:
          "Add people to the channels they belong in. Only members can see a channel's contents, so the client can sit in Design without also being in Finance.",
        platform: "web",
        note: "Membership is managed on web; mobile respects it.",
      },
      {
        name: "Teams",
        description:
          "Group the people you work with repeatedly so they are easier to pull into a new project.",
        platform: "web",
      },
    ],
  },
  {
    title: "Working together",
    description:
      "Conversation is scoped to the channel it belongs to, so it stays findable months later",
    features: [
      {
        name: "Messages and threaded replies",
        description:
          "Post to a channel and reply in a thread. Deleting your own message leaves the replies under it intact.",
        platform: "both",
        note: "Web threads nest several levels deep; mobile threads go one level.",
      },
      {
        name: "File attachments",
        description:
          "Attach photographs, drawings, PDFs, spreadsheets, and audio or video files to any message. Image and video attachments preview inline.",
        platform: "both",
        note: "Web picks several files at once; mobile picks one at a time and lets you rename it first.",
      },
      {
        name: "Mentions and the Inbox",
        description:
          "Mention someone and it lands in their Inbox, with the project, BuildUnit and channel it came from. Opening it jumps straight to the message.",
        platform: "both",
        note: "Mentions are written on web; both clients receive and read them.",
      },
    ],
  },
  {
    title: "Tasks",
    description: "The work itself, assigned and tracked inside the channel it belongs to",
    features: [
      {
        name: "Create and assign",
        description:
          "Open a task in any channel and assign it to someone on the project.",
        platform: "both",
      },
      {
        name: "Completion notes as history",
        description:
          "Closing or reopening a task requires a note. Those notes accumulate into the task's history, so months later you can read why something changed, not just that it did.",
        platform: "both",
      },
      {
        name: "Properties",
        description:
          "Priority, status, start and target dates, percent complete and labels — on tasks, and on projects, BuildUnits and channels too.",
        platform: "web",
        note: "Edited on web; mobile displays them and sets task status.",
      },
      {
        name: "My Tasks",
        description:
          "Everything assigned to you across every project, open first, with a live count.",
        platform: "both",
      },
      {
        name: "Filter BuildUnits",
        description:
          "Narrow a project by name, health, priority, target date, the task it is waiting on, or how far along it is.",
        platform: "web",
      },
    ],
  },
  {
    title: "Files",
    description: "Drawings, photographs and documents, kept against the unit they describe",
    features: [
      {
        name: "Upload to a channel, message or task",
        description:
          "Files carry a name and description and stay attached to the thing they document.",
        platform: "both",
      },
      {
        name: "Scheduled upload",
        description:
          "Hold a large upload until a chosen date and hour — useful when the site has metered or intermittent data and you would rather send at night.",
        platform: "both",
      },
      {
        name: "Uploads that survive a bad connection",
        description:
          "Interrupted uploads retry with backoff instead of failing outright.",
        platform: "both",
        note: "Mobile resumes an interrupted upload automatically; web hands it back to you to restart.",
      },
      {
        name: "Download to the device",
        description:
          "Pull a drawing down to look at it away from signal.",
        platform: "both",
        note: "Mobile saves to a folder you choose on Android, or through the share sheet on iOS.",
      },
    ],
  },
  {
    title: "Offline",
    description:
      "Sites lose signal. The app is built so that the work does not stop when the connection does",
    features: [
      {
        name: "Work without a connection",
        description:
          "Send messages and replies, create tasks, assign them, close and reopen them, and edit properties — all offline. Changes queue in order on the device and sync when you are back in range.",
        platform: "both",
      },
      {
        name: "A local copy of your projects",
        description:
          "Your projects are stored on the device, so opening the app offline shows real data rather than an error.",
        platform: "both",
        note: "Mobile syncs one project at a time, keeping the working set small on a phone.",
      },
      {
        name: "Offline in the browser too",
        description:
          "The web app installs as a PWA and opens offline — including on a direct URL or a refresh.",
        platform: "web",
      },
      {
        name: "What still needs signal",
        description:
          "Creating a project, BuildUnit or channel, logging in, and the actual transfer of file uploads. The app tells you plainly rather than queueing something it cannot complete.",
        platform: "both",
      },
    ],
  },
  {
    title: "Accounts",
    description: "Getting in, and keeping the device safe afterwards",
    features: [
      {
        name: "Passwordless sign-in",
        description:
          "A six-digit code by email — nothing to choose, forget or reuse.",
        platform: "both",
        note: "New accounts are created on web; mobile signs in an existing account.",
      },
      {
        name: "Sign-out clears the device",
        description:
          "Signing out wipes the local copy of your projects, so a shared or handed-on phone does not keep them.",
        platform: "both",
      },
    ],
  },
];
