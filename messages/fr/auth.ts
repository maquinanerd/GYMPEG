import { auth as english } from '../en/auth';
import type { MessageShape } from '@/i18n/message-types';

export const auth = {
  login: {
    title: 'Connexion',
    description: 'Accédez à votre carnet d’entraînement.',
    submit: 'Se connecter',
    submitting: 'Connexion...',
    demoTitle: 'Compte démo',
    demoSubmit: 'Entrer en démo',
    noAccount: 'Pas encore de compte ?',
    createAccount: 'En créer un',
    error: 'Erreur de connexion.',
    accountDeleted: 'Votre compte et toutes ses données ont été supprimés.',
  },
  signup: {
    title: 'Créer un compte',
    description: 'Commencez à suivre vos entraînements.',
    submit: 'Créer le compte',
    submitting: 'Création du compte...',
    hasAccount: 'Déjà un compte ?',
    signIn: 'Se connecter',
    error: 'Erreur lors de l’inscription.',
    restricted:
      'Les inscriptions se font uniquement sur invitation. Demandez une invitation pour créer un compte.',
  },
  logout: 'Se déconnecter',
  validation: {
    invalidEmail: 'Email invalide',
    nameRequired: 'Nom requis',
    passwordRequired: 'Mot de passe requis',
    passwordMin: 'Le mot de passe doit contenir au moins 8 caractères',
  },
} satisfies MessageShape<typeof english>;
