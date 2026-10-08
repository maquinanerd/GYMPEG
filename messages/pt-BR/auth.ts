import { auth as english } from '../en/auth';
import type { MessageShape } from '@/i18n/message-types';

export const auth = {
  login: {
    title: 'Entrar',
    description: 'Acesse seu histórico de treinos.',
    submit: 'Entrar',
    submitting: 'Entrando...',
    demoTitle: 'Conta de demonstração',
    demoSubmit: 'Entrar como demonstração',
    noAccount: 'Ainda não tem conta?',
    createAccount: 'Criar conta',
    error: 'Erro ao entrar.',
  },
  signup: {
    title: 'Criar conta',
    description: 'Comece a registrar seus treinos.',
    submit: 'Criar conta',
    submitting: 'Criando conta...',
    hasAccount: 'Já tem uma conta?',
    signIn: 'Entrar',
    error: 'Erro ao criar a conta.',
  },
  logout: 'Sair',
  validation: {
    invalidEmail: 'E-mail inválido',
    nameRequired: 'Informe o nome',
    passwordRequired: 'Informe a senha',
    passwordMin: 'A senha deve ter pelo menos 8 caracteres',
  },
} satisfies MessageShape<typeof english>;
