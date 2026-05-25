import type { Contact } from './contacts';

let selected: Contact | null = null;

export function setSelectedContact(c: Contact) {
  selected = c;
}

export function getSelectedContact(): Contact | null {
  return selected;
}

export function clearSelectedContact() {
  selected = null;
}
