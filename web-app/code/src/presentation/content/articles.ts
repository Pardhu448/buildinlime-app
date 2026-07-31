/**
 * Blog and documentation content, newest first.
 *
 * There is no articles table yet, so this sits here the way FeaturesCarousel's
 * slides do — swap it for a query when one exists. It lives outside the pages
 * because /resources, /blog and /documentation all read the same lists.
 */

export type Article = {
  title: string;
  /** ISO date, used for the <time> machine-readable value. */
  date: string;
  /** How the date reads on screen. */
  displayDate: string;
  author: string;
  category: string;
  /** One-line standfirst — all /resources shows, and the lead on the listings. */
  excerpt: string;
  /** Full text, one string per paragraph. Only the listing pages render it. */
  body: string[];
};

/**
 * Stable anchor id for an article, derived from its title.
 *
 * /resources links to the full article on /blog or /documentation with this as
 * the URL hash, and ArticleList stamps it as the `id` on the matching section —
 * so both sides agree without an id needing to be written into the content.
 */
export function articleSlug(article: Pick<Article, "title">): string {
  return article.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const BLOG_ARTICLES: Article[] = [
  {
    title: "Why we organize construction around BuildUnits",
    date: "2026-07-14",
    displayDate: "14 July 2026",
    author: "Partha",
    category: "Product",
    excerpt:
      "A BuildUnit can be a crew's work, a room, or the overlap of the two. What makes it a unit is that something completes there — and that a particular set of people needs to watch it.",
    body: [
      "Most construction software decides in advance how your project is divided. Some organize by trade, some by floor and room, and either way the structure arrives before you do. It reads well on a plan. It rarely survives contact with how a particular project is actually being run, because the thing worth tracking as one piece differs from project to project — and often between two people on the same project.",
      "So a BuildUnit is deliberately not defined for you. It is any slice of the project you want to hold as one thing: something that gets completed, that has its own materials and money and record, and that a particular set of people needs to watch. It can follow a team, a place, or the overlap of the two. What makes it a unit is that different aspects of the construction have to come together for it to be finished.",
      "The cleanest case is work one team takes from start to signoff. Plastering is that: one crew, one mix approved once and used throughout, one set of lead times, one completion. Rainwater harvesting is that. When a unit is drawn this way, everything hanging off it has the same owner — the drawings specifying the coats, the lime and its slaking time, the budget line, the panel photographs at each cure stage, and the argument about whether the second coat went on too early.",
      "But a unit does not have to be a team's work. A client who wants to follow the kitchen — and only the kitchen, with their family, without the execution detail — should make the kitchen a BuildUnit. It carries the Design and Finance channels they care about and nothing else, and the people invited into those channels are the people who belong in that conversation. The masons and the plumber are working to their own units elsewhere; this one exists because a decision about the kitchen is being made by a group with no reason to read a site log.",
      "The overlap works too. If what is being decided and paid for is kitchen plastering specifically — a different finish from the rest of the house, quoted separately, signed off on its own — then kitchen plastering is the unit. It is not a compromise between the two other shapes. It is the thing that actually gets completed, which is the only test that matters.",
      "This flexibility is the point rather than a concession. A unit sets two things at once: what the record is attached to, and who is in the room. Because channels are opened per unit and people are invited per channel, drawing a unit around the kitchen gives the client's family a place to decide something without wading through cure schedules, while drawing one around plastering gives the crew a place to work without their mix ratios being discussed by people who will never mix anything.",
      "The judgement worth applying is at the edges. A unit so broad that nobody can say whether it is finished — the ground floor, the house — stops being useful, because its budget is the partial spend of everyone and its completion date belongs to no one. A unit so narrow that the same conversation has to happen in five places is the opposite failure. In between, if you can name what completes it and who needs to see it, it is a BuildUnit.",
    ],
  },
  {
    title: "Notes from a site visit: what gets lost between calls",
    date: "2026-06-28",
    displayDate: "28 June 2026",
    author: "Partha",
    category: "Field Notes",
    excerpt:
      "A week of watching handoffs between the architect and the site supervisor, and where the information fell through.",
    body: [
      "We spent a week on a site with no intention of demonstrating anything. The brief was to watch how a decision travels from the architect to the mason, and to write down every point where it stopped travelling.",
      "The pattern was consistent. Decisions were made on phone calls, and phone calls leave no residue. A mix ratio agreed on Tuesday was re-agreed on Friday, slightly differently, because nobody could recall the first version with confidence. Neither party was careless — the information simply had nowhere to live between the two conversations.",
      "Photographs were the second gap. The supervisor took them constantly, and they were genuinely good: close, well-lit, taken at the moment that mattered. They went into a chat thread, where they were unfindable within about two days. By the time anyone wanted to compare a cure at seven days against the same panel at fourteen, the earlier photograph had scrolled into the past and nobody was willing to hunt for it.",
      "The third gap was the one that cost money. A material lead time — lime slaking, which cannot be hurried — was known to the architect and not written anywhere the supervisor would see it. The crew arrived ready to work on a wall that could not be plastered for another ten days.",
      "None of these are communication failures in the usual sense. Everyone spoke to everyone. What was missing was a place for the outcome of a conversation to sit, attached to the thing it was about, where the next person to need it would trip over it without having to know it existed.",
    ],
  },
  {
    title: "Lime plaster, and why the schedule bends around it",
    date: "2026-06-02",
    displayDate: "2 June 2026",
    author: "Partha",
    category: "Materials",
    excerpt:
      "Natural materials cure on their own timeline. Planning around that beats planning against it.",
    body: [
      "Cement sets on a schedule you can plan around. Lime does not set so much as slowly become itself, and it does that at a pace decided by humidity, temperature and how thickly it was applied. Any schedule that treats a lime coat as a fixed-duration task is a schedule that will be wrong.",
      "The practical consequence is that sequencing matters more than crew availability. A double coat of lime plaster needs the first coat to have carbonated enough to take the second — push it early and the finish crazes, wait too long and the coats bond poorly. The window is real but it is not a date you can print in advance.",
      "This is why we put the roof before the interior plaster in the sample project, and why that ordering is not negotiable. Plaster mid-cure that gets rained on is plaster you redo. The roof is not on the critical path because it is difficult; it is there because everything downstream of it is vulnerable until it exists.",
      "The scheduling habit that works is to set target dates off cure times and let crew allocation follow, rather than the reverse. It feels backwards to anyone used to cement, and it is the single change that most reliably keeps a natural-building project from compounding small delays into large ones.",
    ],
  },
];

export const DOCUMENTATION_ARTICLES: Article[] = [
  {
    title: "Getting started: your first project",
    date: "2026-07-10",
    displayDate: "10 July 2026",
    author: "Partha",
    category: "Guide",
    excerpt:
      "Create a project, break it into BuildUnits, and invite your architect and site supervisor to their first channel.",
    body: [
      "Signing up takes a name and an email address. There is no password to choose — we email a six-digit code, and entering it both confirms the address and signs you in. The name you give is what teammates see on comments and task assignments, so use the name you go by on site.",
      "Once you are in, click New Project. Name it for the building, not the client, and put the one-paragraph brief in the description. You need to be online to create a project; everything after that syncs.",
      "Next, break the house into BuildUnits. A BuildUnit is any piece you want to track as one thing, and where its edges fall is your call. Splitting by place works — foundation, each room, roof, rainwater harvesting. So does splitting by a crew's work, like plastering, when one team owns it from start to signoff. So does the overlap, like kitchen plastering, when that is what gets quoted and signed off on its own.",
      "Two things make a unit worth drawing: you can name what completes it, and you can name who needs to watch it. A client following only the kitchen with their family is reason enough for the kitchen to be a unit — it carries the Design and Finance channels they care about and none of the site detail. What does not work is a unit so broad that nobody can say whether it is finished, or so narrow that the same conversation has to happen in five places.",
      "Inside each BuildUnit, open the channels it needs. There are seven types — Finance, Requirements, Design, Materials, Tools, Execution and Experimentation — and each type can be opened once per BuildUnit, so a channel name is never ambiguous. Most units start with Requirements and Design and grow the rest as work begins.",
      "Finally, invite the people building it. The architect, the site supervisor and the mason lead see the same BuildUnits and channels you do, and photographs uploaded from a phone on site sync to everyone on the project.",
    ],
  },
  {
    title: "Channels, tasks and comments",
    date: "2026-06-20",
    displayDate: "20 June 2026",
    author: "Partha",
    category: "Guide",
    excerpt:
      "How conversation is scoped in BuildInLime, and when to open a channel instead of a task.",
    body: [
      "A channel is a subject area within a BuildUnit. A task is a piece of work with an owner and a date. The distinction matters because putting work in a channel loses its accountability, and putting a subject in a task buries it under something that will eventually be marked done.",
      "The seven channel types are fixed deliberately. Finance holds estimates and actuals for that unit, so an overrun stays visible against whatever the unit is — the roof, or plastering — instead of dissolving into a project total. Requirements holds decisions already made. Design holds drawings. Materials holds what the unit consumes, including lead times. Tools holds equipment. Execution holds the build itself. Experimentation holds trial panels and mixes.",
      "Experimentation is the one people skip and then wish they had not. Run a panel of the limecrete bed or the double-coat plaster, photograph it at each cure stage, and comment the mix ratio the panel actually used. When a mix is approved, it becomes the reference every room is built against — and the photographs are the evidence for why.",
      "Comments belong on the task or channel they concern, not in a general thread. This is the habit that takes longest to build and pays back the most: six months later, the reason a decision was made is attached to the thing it was made about.",
    ],
  },
  {
    title: "Uploading drawings and site photographs",
    date: "2026-05-30",
    displayDate: "30 May 2026",
    author: "Partha",
    category: "Reference",
    excerpt:
      "Attachment limits, supported formats, and how uploads sync to everyone else on the project.",
    body: [
      "Attachments go on channels and tasks. Drawings belong in the BuildUnit's Design channel; site photographs usually belong on the Execution task they document, so the record of what happened sits with the work it happened to.",
      "Heavy files can be scheduled rather than sent immediately. Pick a date and an hour when you attach the file, and the upload waits until then — useful when you are on site with a slow connection and a folder of full-resolution photographs, and would rather they went up overnight than fought you for bandwidth while you are still working.",
      "Everything uploaded anywhere in a channel is collected in that channel's Resources section. You do not have to remember which task or comment a drawing arrived on: the Resources view is the single list of every file on the channel, which is usually the fastest way back to something somebody attached weeks ago.",
      "You can delete an attachment you own. The delete control appears on files you uploaded — and on files attached to a task you created — and removing one removes it for everyone on the project, so you are asked to confirm first.",
      "The roof build-up and the verandah wall detail are worth their own drawings rather than being folded into a general plan. Exposed laterite gives you no opportunity to correct coursing afterwards, so the detail needs to be legible on its own on a phone screen in daylight.",
      "Photographs of trial panels should be taken at each cure stage from roughly the same position and distance. Consistency is what makes them comparable later, and comparison is the entire point of running a panel.",
    ],
  },
];
