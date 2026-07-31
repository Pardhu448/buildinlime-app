import { Header, HeaderLoggedIn, Footer, StepSection } from "../components/buildInlime";
import type { Step } from "../components/buildInlime";
import { signOutAndDispose, useRequireAuth } from "../../infrastructure/auth/client";

/**
 * Placeholder content in the same spirit as ResourcesPage's article lists — the
 * copy lives here rather than in a CMS, because there isn't one yet.
 */

/**
 * One way the sample house breaks into BuildUnits — by room, which suits this
 * brief. Rendered as a worked "how would I model this" answer before the steps
 * that build it, not as the only shape a unit can take.
 */
const SAMPLE_BUILD_UNITS: { name: string; scope: string }[] = [
  {
    name: "Foundation & Plinth",
    scope:
      "Shallow excavation — the rocky terrain rules out a deep basement. Laterite stone footings set in lime concrete.",
  },
  {
    name: "Verandah",
    scope:
      "Exposed laterite walls, no plaster. Tandur stone flooring on a limecrete bed.",
  },
  {
    name: "Hall",
    scope: "Double-coat lime plaster inside. Tandur stone flooring on limecrete.",
  },
  {
    name: "Kitchen & Dining",
    scope:
      "Double-coat lime plaster, tandur stone flooring, and the wet-area detailing the room needs.",
  },
  {
    name: "Bedroom",
    scope: "Double-coat lime plaster inside, tandur stone flooring on limecrete.",
  },
  {
    name: "External Bathroom",
    scope:
      "Detached from the main block. Its own drainage, and lime plaster specified for constant damp.",
  },
  {
    name: "Roof",
    scope:
      "Limecrete variation of a Madras terrace, tandur stone joists, finished with thin tandur stone slabs against rainwater seepage.",
  },
  {
    name: "Rainwater Harvesting",
    scope:
      "Gutters, downpipes, filtration and the storage tank — sized off the roof area, so it depends on the Roof unit.",
  },
];

const SAMPLE_PROJECT_STEPS: Step[] = [
  {
    title: "Create your account",
    detail:
      "Click Login in the header and choose Create an account. Give your full name and email address — there is no password to choose.",
    points: [
      "Your name is what teammates see on comments, task assignments and channel activity, so use the name you go by on site.",
      "If an account already exists for that email, we tell you and offer to log you in instead.",
    ],
  },
  {
    title: "Verify with the emailed code",
    detail:
      "We email you a six-digit code. Enter it to confirm the address, which signs you in and saves your name to your profile.",
    points: [
      "Codes expire; use Resend if one goes stale or never arrives.",
      "Check spam if the email is slow to land.",
      "Back to email lets you correct a typo in the address without starting over.",
    ],
  },
  {
    title: "Create the project",
    detail:
      'From your workspace, click New Project. Name it something like "Laterite Village Home" and put the one-paragraph brief in the description. You have to be online to create a project.',
  },
  {
    title: "Break the house into BuildUnits",
    detail:
      "Open the project and add a BuildUnit for each piece you want to track as one thing. A BuildUnit is the shared address that drawings, budgets, materials and site updates hang off, and you decide where its edges are — the eight above split this house by room, which suits this brief.",
    points: [
      "A unit can follow a place, a team's work, or the overlap. Plastering on its own works if one crew owns it end to end; so does Kitchen Plastering, if that is what gets quoted and signed off separately.",
      "Rainwater Harvesting is its own unit here because it has its own materials, its own budget and its own completion date.",
      "The useful test is whether you can name what completes the unit and who needs to watch it. Something as broad as the whole ground floor fails the first half; a unit so narrow that the same conversation repeats in five places fails the second.",
    ],
  },
  {
    title: "Open the channels each BuildUnit needs",
    detail:
      "Inside a BuildUnit, click New Channel and pick from the seven types: Finance, Requirements, Design, Materials, Tools, Execution and Experimentation. Each type corresponds to a particular aspect of the BuildUnit. Everything related to a channel of the BuildUnit is communicated through messages and tasks.",
  },
  {
    title: "Add people to the channels and start talking",
    detail:
      "Add the relevant people to each channel and start the conversation through messages, images, audio and video. Only invited users can see a channel's details — so you might want only the architect and the client in Design.",
  },
];

function SampleBrief() {
  return (
    <div className="bg-card-surface border border-border rounded-[10px] p-[32px] flex flex-col gap-[24px]">
      <div className="flex flex-col gap-[8px]">
        <h3
          className="font-['Instrument_Sans',sans-serif] font-semibold text-[18px] leading-[26px] text-black"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          The brief
        </h3>
        <p
          className="font-['Instrument_Sans',sans-serif] text-[15px] leading-[22px] text-black max-w-[788px]"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          A laterite stone village home — verandah, hall, kitchen/dining, bedroom
          and an external bathroom. The terrain is rocky, so the basement stays
          shallow. Lime concrete replaces cement throughout. The roof is a
          limecrete variation of a Madras terrace carried on tandur stones and
          covered with thin tandur slabs against rainwater seepage. Floors are
          tandur stone on a limecrete bed. The verandah and all outer walls are
          left exposed; the remaining interior walls take a double coat of lime
          plaster. Rainwater is harvested off the roof.
        </p>
      </div>

      <div className="flex flex-col gap-[12px]">
        <h4
          className="font-['Instrument_Sans',sans-serif] font-medium text-[15px] leading-[22px] text-black"
          style={{ fontVariationSettings: "'wdth' 100" }}
        >
          One way it breaks into BuildUnits
        </h4>
        <ul className="flex flex-col">
          {SAMPLE_BUILD_UNITS.map((unit) => (
            <li
              key={unit.name}
              className="flex flex-col gap-[4px] py-[12px] border-b border-border last:border-b-0 last:pb-0"
            >
              <span
                className="font-['Instrument_Sans',sans-serif] font-medium text-[15px] leading-[22px] text-black"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {unit.name}
              </span>
              <span
                className="font-['Instrument_Sans',sans-serif] text-[13px] leading-[18px] text-muted-foreground"
                style={{ fontVariationSettings: "'wdth' 100" }}
              >
                {unit.scope}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function GettingStartedPage() {
  const { user } = useRequireAuth();
  const loggedIn = !!user;

  const handleSignOut = async () => {
    await signOutAndDispose();
    window.location.href = "/";
  };

  return (
    <div className="bg-white flex flex-col items-start min-h-screen">
      {loggedIn ? <HeaderLoggedIn onSignOut={handleSignOut} /> : <Header />}

      {/* Page heading */}
      <section className="w-full bg-gradient-to-b from-white to-muted px-6 lg:px-[120px] pt-[40px] pb-[28px]">
        <div className="max-w-[1270px] mx-auto flex flex-col items-center gap-[12px]">
          <h1 className="font-['Inria_Sans',sans-serif] font-bold text-[26px] leading-[40px] text-foreground text-center max-w-[786px]">
            Getting Started
          </h1>
          <p
            className="font-['Instrument_Sans',sans-serif] text-[18px] leading-[26px] text-muted-foreground text-center max-w-[788px]"
            style={{ fontVariationSettings: "'wdth' 100" }}
          >
            Create your account, then walk a real natural-building project
            through the platform from brief to site
          </p>
        </div>
      </section>

      <StepSection
        id="sample-project"
        title="Sample Project on BuildInLime"
        description="A worked example, start to finish: signing up, then setting up a laterite and lime village home and running it through projects, BuildUnits and channels"
        steps={SAMPLE_PROJECT_STEPS}
      >
        <SampleBrief />
      </StepSection>

      <Footer compact />
    </div>
  );
}
