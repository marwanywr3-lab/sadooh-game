import { CharacterDefinition, CharacterId } from '../../types/game';

/**
 * تعريف الشخصيات الست وقدراتها الرسمية في لعبة «صادوه!»
 * لكل شخصية قدرة واحدة فقط في سطر عربي واضح.
 */
export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  malqoof: {
    id: 'malqoof',
    nameAr: 'الملقوف',
    descriptionAr: 'اكشف لنفسك بطاقة عشوائية من يد لاعب تختاره.',
    requiresTarget: true,
    assetPath: './assets/malqoof.svg',
    accentColor: '#2a9d8f',
    badgeTextAr: 'كشف سري',
  },
  nashal: {
    id: 'nashal',
    nameAr: 'النشّال',
    descriptionAr: 'اسحب بطاقة عشوائية من يد لاعب تختاره.',
    requiresTarget: true,
    assetPath: './assets/nashal.svg',
    accentColor: '#e76f51',
    badgeTextAr: 'سحب من خصم',
  },
  sanad: {
    id: 'sanad',
    nameAr: 'السند',
    descriptionAr: 'احمِ نفسك من أول قدرة تستهدفك حتى دورك القادم.',
    requiresTarget: false,
    assetPath: './assets/sanad.svg',
    accentColor: '#588157',
    badgeTextAr: 'حماية ذاتية',
  },
  mosarref: {
    id: 'mosarref',
    nameAr: 'المصرّف',
    descriptionAr: 'تخلّص من بطاقة إضافية من يدك.',
    requiresTarget: false,
    assetPath: './assets/mosarref.svg',
    accentColor: '#d97706',
    badgeTextAr: 'تصريف إضافي',
  },
  mokhabbes: {
    id: 'mokhabbes',
    nameAr: 'المخبّص',
    descriptionAr: 'بدّل بطاقة من يدك ببطاقة عشوائية من يد لاعب آخر.',
    requiresTarget: true,
    assetPath: './assets/mokhabbes.svg',
    accentColor: '#b5382a',
    badgeTextAr: 'تبديل عشوائي',
  },
  alkabeer: {
    id: 'alkabeer',
    nameAr: 'الكبير',
    descriptionAr: 'اجعل لاعبًا تختاره يسحب بطاقة من الكومة.',
    requiresTarget: true,
    assetPath: './assets/alkabeer.svg',
    accentColor: '#7c4d2b',
    badgeTextAr: 'إلزام بالسحب',
  },
};

export const CHARACTER_LIST: CharacterDefinition[] = [
  CHARACTERS.malqoof,
  CHARACTERS.nashal,
  CHARACTERS.sanad,
  CHARACTERS.mosarref,
  CHARACTERS.mokhabbes,
  CHARACTERS.alkabeer,
];

export const ALL_CHARACTER_IDS: CharacterId[] = CHARACTER_LIST.map((c) => c.id);
