import type { Mode } from './model';

export interface ModePresentation {
  name: string;
  description: string;
}

export const MODE_PRESENTATION: Record<Mode, ModePresentation> = {
  A: {
    name: 'All in',
    description: 'Full session.',
  },
  B: {
    name: 'Busy day',
    description: 'Cut to the essentials.',
  },
  C: {
    name: "Can’t be arsed",
    description: 'Minimum useful dose.',
  },
};
