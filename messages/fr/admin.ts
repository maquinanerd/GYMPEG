import { admin as english } from '../en/admin';
import type { MessageShape } from '@/i18n/message-types';

export const admin = {
  title: 'Administration',
  back: 'Réglages',
  description:
    "Définissez un nouveau mot de passe pour quelqu'un qui ne peut pas se connecter. La personne est déconnectée de tous ses appareils et se connecte avec le nouveau mot de passe.",
  usersTitle: '{count, plural, one {# compte} other {# comptes}}',
  adminTag: 'Admin',
  youTag: 'Vous',
  lastSeen: 'Dernière activité le {date}',
  neverSignedIn: 'Jamais connecté',
  setPassword: 'Définir le mot de passe',
  setPasswordFor: 'Définir le mot de passe pour {email}',
  dialogTitle: 'Nouveau mot de passe',
  dialogDescription:
    'Saisissez un mot de passe ou générez-en un. Toutes les sessions de ce compte prennent fin maintenant.',
  newPassword: 'Nouveau mot de passe',
  generate: 'Générer',
  submit: 'Définir le mot de passe',
  saving: 'Enregistrement...',
  cancel: 'Annuler',
  tooShort: 'Le mot de passe doit contenir au moins {min} caractères.',
  tooLong: 'Le mot de passe est trop long.',
  forbidden: 'Seuls les administrateurs peuvent faire cela.',
  notFound: "Ce compte n'existe plus.",
  rateLimited: 'Trop de changements à la suite. Attendez quelques minutes et réessayez.',
  error: "Une erreur s'est produite. Réessayez.",
  done: '{count, plural, =0 {Mot de passe défini.} one {Mot de passe défini. # appareil a été déconnecté.} other {Mot de passe défini. # appareils ont été déconnectés.}}',
  copy: 'Copier le mot de passe',
  copied: 'Mot de passe copié.',
  copyError: 'Copie impossible. Sélectionnez le mot de passe et copiez-le à la main.',
  handOver:
    'Envoyez-le à la personne par un canal privé et demandez-lui de le changer dans Réglages après sa connexion.',
  finish: 'Terminé',
} satisfies MessageShape<typeof english>;
