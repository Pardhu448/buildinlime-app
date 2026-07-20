/**
 * Who we are and what we believe, for /about.
 *
 * Prose rather than feature claims — this is the one page that says why the
 * software is shaped the way it is, so it stays in the first person and avoids
 * promising anything the product doesn't do yet.
 */

export type AboutSection = {
  title: string;
  paragraphs: string[];
};

export const ABOUT_INTRO =
  "We are a small group of professionals with a shared interest in alternative ways of living. We build software at community scale and customized for the community needs.";

export const ABOUT_SECTIONS: AboutSection[] = [
  {
    title: "Where we come from",
    paragraphs: [
      "As part of our exploration of alternative ways of living we came across natural and eco-friendly architecture and buildings — mud, lime, local materials and methods that sit light on the places they are built in.",
      "Our thinking is motivated by the work of Laurie Baker, Thannal, and the many other natural builders who showed that thoughtful, low-cost, climate-appropriate building is not a compromise but a craft.",
    ],
  },
  {
    title: "Software at community scale",
    paragraphs: [
      "We build software for the community we are ourselves a part of. That proximity is the point: we would rather solve a real problem for the people around us than a generic one for nobody in particular.",
      "So we believe in community-scale, custom solutions that cater to the actual needs of our community, rather than tools that ask a community to reshape itself to fit the software.",
    ],
  },
  {
    title: "The community keeps its data",
    paragraphs: [
      "We believe in data sovereignty. The information a community generates through our applications — its drawings, its costs, its site records — belongs to that community, and we are particular about keeping it in the community's control.",
      "In support of this, we are members of the Mozilla Data Collective.",
    ],
  },
  {
    title: "AI that is built and run locally",
    paragraphs: [
      "We believe AI should be built and run locally, close to the people it serves, and shaped around local community needs rather than delivered as a remote service that decides on their behalf.",
    ],
  },
];
