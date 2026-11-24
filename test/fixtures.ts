import type { Data } from '../application/validation';

export const PEOPLE_URL =
  'https://randomapi.com/api/6de6abfedb24f889e0b5f675edc50deb?fmt=raw&sole&seed=123';

export const people: Data = [
  {
    first: 'Ada',
    last: 'Lovelace',
    email: 'ada@example.com',
    address: '1 Analytical Way',
    created: 'December 10, 2015',
    balance: '$1,815.00',
  },
  {
    first: 'Alan',
    last: 'Turing',
    email: 'alan@example.com',
    address: '2 Enigma Road',
    created: 'June 23, 2012',
    balance: '$1,912.00',
  },
];
