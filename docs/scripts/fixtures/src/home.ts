import { saveThings } from './store';

export function addThing(things: string[], label: string) {
  const next = [...things, label];
  saveThings(next);
  return next;
}

export function HomeScreen() {
  return addThing([], 'first');
}
