export type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  company?: string;
};

export const CONTACTS: Contact[] = [
  { id: 'c1', name: 'Jan de Vries', phone: '+31 6 1234 5678', email: 'jan@example.com', company: 'Kantoor BV' },
  { id: 'c2', name: 'Sanne Jansen', phone: '+31 6 2345 6789', email: 'sanne@example.com', company: 'Restaurant X' },
  { id: 'c3', name: 'Pieter Bakker', phone: '+31 6 9876 5432', email: 'pieter@example.com', company: 'Café Y' },
  { id: 'c4', name: 'Fatima Ali', phone: '+31 6 5555 1212', email: 'fatima@example.com', company: 'Hotel Z' },
];

export default CONTACTS;
