export type CardBase = {
  id: string;
  title: string;
  ts: string;
  source: string;
  venue?: string;
};

export type EventCard = CardBase & {
  type: "event";
  when: string;
  where: string;
  blurb: string;
  freeFood: boolean;
  link?: string;
};

export type FoodCard = CardBase & {
  type: "food";
  hall: string;
  when: string;
  items: string[];
};

export type PulseCard = CardBase & {
  type: "pulse";
  text: string;
  citations: string[];
};

export type PlanStep = {
  time: string;
  what: string;
  where: string;
};

export type PlanCard = CardBase & {
  type: "plan";
  steps: PlanStep[];
};

export type OppCard = CardBase & {
  type: "opp";
  org: string;
  deadline: string;
  blurb: string;
  link?: string;
};

export type Card = EventCard | FoodCard | PulseCard | PlanCard | OppCard;

export type Activity = {
  id: number;
  bot: string;
  text: string;
  ts: string;
};
