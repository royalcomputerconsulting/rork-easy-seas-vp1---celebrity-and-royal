import type { ImageSourcePropType } from 'react-native';

export interface BookDropBook {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  cover: ImageSourcePropType;
  primaryName: string;
  primaryAsset: number;
  alternateName?: string;
  alternateAsset?: number;
  featured?: boolean;
}

export const BOOKDROP_PROMO_CODES_ASSET = require('../../assets/bookdrop/promo-codes.txt');

export const BOOKDROP_BOOKS: BookDropBook[] = [
  {
    id: 'smooth-sailings',
    title: 'Smooth Sailings in Rough Waters',
    subtitle: 'Living at sea for the wealthy—or nothing.',
    category: 'Cruise Life',
    cover: require('../../assets/bookdrop/covers/smooth-sailings.jpg'),
    primaryName: 'smooth-sailings.docx',
    primaryAsset: require('../../assets/bookdrop/books/smooth-sailings.docx'),
    alternateName: 'smooth-sailings.epub',
    alternateAsset: require('../../assets/bookdrop/books/smooth-sailings.epub'),
    featured: true,
  },
  {
    id: 'only-on-a-cruise-ship',
    title: 'Only on a Cruise Ship',
    subtitle: 'Sea strange, scandal & unbelievable tales from life at sea.',
    category: 'Cruise Life',
    cover: require('../../assets/bookdrop/covers/only-on-a-cruise-ship.png'),
    primaryName: 'only-on-a-cruise-ship.docx',
    primaryAsset: require('../../assets/bookdrop/books/only-on-a-cruise-ship.docx'),
    featured: true,
  },
  {
    id: 'my-way',
    title: 'My Way',
    subtitle: 'An autobiography by Scott A. Astin.',
    category: 'Memoir',
    cover: require('../../assets/bookdrop/covers/my-way.jpg'),
    primaryName: 'my-way.docx',
    primaryAsset: require('../../assets/bookdrop/books/my-way.docx'),
    featured: true,
  },
  {
    id: 'slot-machine-handbook',
    title: 'The Slot Machine AP Player Handbook',
    subtitle: 'Advantage play for over 200 of your favorite slot machines.',
    category: 'Casino',
    cover: require('../../assets/bookdrop/covers/slot-machine-handbook.jpg'),
    primaryName: 'slot-machine-handbook.docx',
    primaryAsset: require('../../assets/bookdrop/books/slot-machine-handbook.docx'),
    featured: true,
  },
  {
    id: 'first-passenger-back',
    title: 'The First Passenger Back',
    subtitle: 'A journey in search of connection, meaning, and a life beyond the ordinary.',
    category: 'Cruise Life',
    cover: require('../../assets/bookdrop/covers/first-passenger-back.jpg'),
    primaryName: 'first-passenger-back.docx',
    primaryAsset: require('../../assets/bookdrop/books/first-passenger-back.docx'),
  },
  {
    id: 'six-f-cks',
    title: 'The Six F*cks',
    subtitle: 'A roadmap to your best life: choose what matters and let go of the rest.',
    category: 'Personal Growth',
    cover: require('../../assets/bookdrop/covers/six-f-cks.png'),
    primaryName: 'six-f-cks.docx',
    primaryAsset: require('../../assets/bookdrop/books/six-f-cks.docx'),
  },
  {
    id: 'aguas-serenas',
    title: 'Aguas Serenas',
    subtitle: 'Una historia de reinvención, libertad y vida en el mar.',
    category: 'Español',
    cover: require('../../assets/bookdrop/covers/aguas-serenas.jpg'),
    primaryName: 'aguas-serenas.docx',
    primaryAsset: require('../../assets/bookdrop/books/aguas-serenas.docx'),
  },
  {
    id: 'changes-in-latitudes',
    title: 'Changes in Latitudes… Casino Gratitudes',
    subtitle: 'Casino adventures, ocean escapes, and the stories collected between ports.',
    category: 'Casino & Cruise',
    cover: require('../../assets/bookdrop/covers/changes-in-latitudes.jpg'),
    primaryName: 'changes-in-latitudes.docx',
    primaryAsset: require('../../assets/bookdrop/books/changes-in-latitudes.docx'),
    alternateName: 'changes-in-latitudes.epub',
    alternateAsset: require('../../assets/bookdrop/books/changes-in-latitudes.epub'),
  },
  {
    id: 'back-to-back-to-back',
    title: 'Back to Back to Back',
    subtitle: "A passenger's guide to adventure and escape at sea.",
    category: 'Cruise Life',
    cover: require('../../assets/bookdrop/covers/back-to-back-to-back.jpg'),
    primaryName: 'back-to-back-to-back.docx',
    primaryAsset: require('../../assets/bookdrop/books/back-to-back-to-back.docx'),
  },
  {
    id: 'the-last-voyage',
    title: 'The Last Voyage',
    subtitle: 'The first voyage in a maritime thriller trilogy.',
    category: 'Fiction',
    cover: require('../../assets/bookdrop/covers/the-last-voyage.jpg'),
    primaryName: 'the-last-voyage.docx',
    primaryAsset: require('../../assets/bookdrop/books/the-last-voyage.docx'),
  },
  {
    id: 'the-second-crossing',
    title: 'The Last Voyage: The Second Crossing',
    subtitle: 'The voyage continues as the mystery deepens.',
    category: 'Fiction',
    cover: require('../../assets/bookdrop/covers/the-second-crossing.jpg'),
    primaryName: 'the-second-crossing.docx',
    primaryAsset: require('../../assets/bookdrop/books/the-second-crossing.docx'),
  },
  {
    id: 'the-final-signal',
    title: 'The Last Voyage: The Final Signal',
    subtitle: 'The final crossing brings the trilogy to its conclusion.',
    category: 'Fiction',
    cover: require('../../assets/bookdrop/covers/the-final-signal.jpg'),
    primaryName: 'the-final-signal.docx',
    primaryAsset: require('../../assets/bookdrop/books/the-final-signal.docx'),
  },
];
