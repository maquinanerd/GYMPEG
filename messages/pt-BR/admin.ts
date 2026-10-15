import { admin as english } from '../en/admin';
import type { MessageShape } from '@/i18n/message-types';

export const admin = {
  title: 'Administração',
  back: 'Configurações',
  description:
    'Defina uma senha nova para quem não consegue entrar. A pessoa sai de todos os dispositivos e entra com a senha nova.',
  usersTitle: '{count, plural, one {# conta} other {# contas}}',
  adminTag: 'Admin',
  youTag: 'Você',
  lastSeen: 'Último acesso em {date}',
  neverSignedIn: 'Nunca entrou',
  setPassword: 'Definir senha',
  setPasswordFor: 'Definir senha para {email}',
  dialogTitle: 'Nova senha',
  dialogDescription: 'Digite uma senha ou gere uma. Todas as sessões desta conta terminam agora.',
  newPassword: 'Nova senha',
  generate: 'Gerar',
  submit: 'Definir senha',
  saving: 'Salvando...',
  cancel: 'Cancelar',
  tooShort: 'A senha precisa ter pelo menos {min} caracteres.',
  tooLong: 'A senha é longa demais.',
  forbidden: 'Só administradores podem fazer isso.',
  notFound: 'Esta conta não existe mais.',
  rateLimited: 'Muitas trocas seguidas. Espere alguns minutos e tente de novo.',
  error: 'Algo deu errado. Tente de novo.',
  done: '{count, plural, =0 {Senha definida.} one {Senha definida. # dispositivo foi desconectado.} other {Senha definida. # dispositivos foram desconectados.}}',
  copy: 'Copiar senha',
  copied: 'Senha copiada.',
  copyError: 'Não foi possível copiar. Selecione a senha e copie à mão.',
  handOver:
    'Envie para a pessoa por um canal privado e peça para ela trocar a senha em Configurações depois de entrar.',
  finish: 'Concluir',
} satisfies MessageShape<typeof english>;
