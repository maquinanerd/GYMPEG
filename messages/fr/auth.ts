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
    forgotPassword: 'Mot de passe oublié ?',
    passwordReset: 'Mot de passe modifié. Connectez-vous avec le nouveau mot de passe.',
  },
  forgot: {
    title: 'Réinitialiser le mot de passe',
    description: 'Nous vous enverrons par e-mail un lien pour choisir un nouveau mot de passe.',
    submit: 'Envoyer le lien',
    submitting: 'Envoi...',
    sent: 'Si un compte utilise cet e-mail, un lien est en route. Il fonctionne une fois, pendant 30 minutes. Vérifiez aussi les spams.',
    unavailable: 'La réinitialisation par e-mail n’est pas configurée sur ce serveur.',
    tooMany: 'Trop de tentatives. Patientez quelques minutes et réessayez.',
    error: 'Impossible d’envoyer le lien. Réessayez.',
    backToLogin: 'Retour à la connexion',
  },
  reset: {
    title: 'Choisissez un nouveau mot de passe',
    description: 'Vous serez déconnecté sur tous les appareils.',
    newPassword: 'Nouveau mot de passe',
    confirmPassword: 'Répétez le nouveau mot de passe',
    mismatch: 'Les mots de passe ne correspondent pas',
    submit: 'Enregistrer le mot de passe',
    submitting: 'Enregistrement...',
    invalid: 'Ce lien est invalide, déjà utilisé ou expiré. Demandez-en un nouveau.',
    requestNew: 'Demander un nouveau lien',
    error: 'Impossible de modifier le mot de passe. Réessayez.',
  },
  resetEmail: {
    subject: 'Réinitialisez votre mot de passe GYM Peg',
    body: 'Nous avons reçu une demande de réinitialisation du mot de passe de votre compte GYM Peg.\n\nPour choisir un nouveau mot de passe, ouvrez ce lien dans les {minutes} minutes :\n{link}\n\nSi vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste le même.',
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
