import { programTemplates as english } from '../en/program-templates';
import type { MessageShape } from '@/i18n/message-types';

export const programTemplates = {
  fiveThreeOneBbb: {
    name: '5/3/1 (Boring But Big, 4 dias)',
    summary:
      'Levantamentos principais do 5/3/1 de Wendler com trabalho complementar 5x10 BBB, 4 dias.',
    attribution:
      '5/3/1 de Jim Wendler. O levantamento principal é calculado sobre o seu training max (TM = 90% do 1RM), em ondas de 5, 3 e 1 repetição de uma semana para outra, com a última série AMRAP (máximo de repetições). O complementar é 5x10 a ~50-60% do TM.',
    programName: '5/3/1 Boring But Big',
    description:
      '5/3/1 de Wendler com o volume complementar Boring But Big. Defina o training max em 90% do seu 1RM e progrida o TM, não a carga de cada dia.',
    phase: 'Força',
    workouts: {
      day1: 'Dia 1 - Desenvolvimento',
      day2: 'Dia 2 - Levantamento terra',
      day3: 'Dia 3 - Supino',
      day4: 'Dia 4 - Agachamento',
    },
    notes: {
      mainLift: 'Levantamento principal. Onda 5/3/1 sobre o training max; última série AMRAP.',
      supplemental: 'Complementar Boring But Big: 5x10 a ~50-60% do TM.',
      pullingAccessory: 'Acessório de puxada para equilibrar o volume de empurrar.',
    },
  },
  gzclp: {
    name: 'GZCLP (progressão linear)',
    summary: 'Progressão linear baseada no GZCL: T1 5x3, T2 3x10, T3 3x15+, 3 dias.',
    attribution:
      'GZCLP de Cody LeFever. T1: 5x3+ pesado, aumente a carga a cada sessão; ao estagnar, passe para 6x2 e depois 10x1. T2: 3x10 (depois 3x8 e 3x6). T3: 3x15+ com a última série AMRAP; aumente a carga quando a última série chegar a 25.',
    programName: 'GZCLP',
    description:
      'Progressão linear baseada no GZCL, com os níveis T1 (força principal), T2 (volume secundário) e T3 (acessórios). Aumente a carga a cada sessão até estagnar e então passe para o próximo esquema de repetições.',
    phase: 'Força',
    workouts: {
      dayA: 'Dia A - Agachamento / Supino',
      dayB: 'Dia B - Desenvolvimento / Levantamento terra',
      dayC: 'Dia C - Supino / Agachamento',
    },
    notes: {
      t1: 'T1: 5x3+, última série AMRAP. Aumente a carga a cada sessão.',
      t2: 'T2: 3x10; ao estagnar, 3x8 e depois 3x6.',
      t3Progression:
        'T3: 3x15+, última série AMRAP. Aumente a carga quando a última série chegar a 25.',
      t3: 'T3: 3x15+, última série AMRAP.',
    },
  },
  ppl: {
    name: 'Push / Pull / Legs (6 dias)',
    summary: 'Divisão PPL clássica de hipertrofia em 6 dias, séries de 8-12 repetições a 1-2 RIR.',
    attribution:
      'Push/Pull/Legs (empurrar, puxar, pernas) padrão, feito duas vezes por semana. Faixas de hipertrofia (8-15 repetições), 1-2 RIR; aumente a carga quando chegar ao topo da faixa em todas as séries.',
    programName: 'Push Pull Legs',
    description:
      'Divisão Push/Pull/Legs de hipertrofia em 6 dias. Faça cada sessão duas vezes por semana; aumente a carga quando chegar ao topo da faixa de repetições em todas as séries.',
    phase: 'Hipertrofia',
    workouts: {
      pushA: 'Empurrar A',
      pullA: 'Puxar A',
      legsA: 'Pernas A',
      pushB: 'Empurrar B',
      pullB: 'Puxar B',
      legsB: 'Pernas B',
    },
  },
  upperLower: {
    name: 'Superiores / Inferiores (4 dias)',
    summary:
      'Divisão superiores/inferiores (upper/lower) em 4 dias, equilibrando força e hipertrofia.',
    attribution:
      'Upper/Lower padrão de 4 dias. Compostos mais pesados (5-8 repetições) no início de cada sessão e acessórios de hipertrofia (8-15 repetições) depois, a 1-2 RIR.',
    programName: 'Superiores / Inferiores',
    description:
      'Divisão superiores/inferiores em 4 dias. Comece por um composto mais pesado e depois acumule volume de hipertrofia nos acessórios. Aumente a carga ao chegar ao topo de cada faixa de repetições.',
    phase: 'Hipertrofia',
    workouts: {
      upperA: 'Superiores A',
      lowerA: 'Inferiores A',
      upperB: 'Superiores B',
      lowerB: 'Inferiores B',
    },
  },
  nsuns: {
    name: 'nSuns 531 LP (4 dias)',
    summary:
      'Progressão linear nSuns 531, 4 dias, ondas de alto volume nos levantamentos principais.',
    attribution:
      'nSuns 531 LP. O levantamento principal segue uma onda de 9 séries (ex.: 8/6/4/4/4/5/6/7/8+ repetições com o %TM subindo e depois descendo); o AMRAP da série-chave define o aumento semanal do TM. Siga a onda registrando as repetições prescritas em cada série.',
    programName: 'nSuns 531 LP',
    description:
      'Progressão linear nSuns 531. Cada levantamento principal segue uma onda de intensidade de 9 séries, com uma série AMRAP que define o aumento do training max da semana seguinte. Faça as repetições prescritas em cada série, como está escrito.',
    phase: 'Força',
    workouts: {
      day1: 'Dia 1 - Supino / Desenvolvimento',
      day2: 'Dia 2 - Agachamento / Terra sumô',
      day3: 'Dia 3 - Desenvolvimento / Supino inclinado',
      day4: 'Dia 4 - Levantamento terra / Agachamento frontal',
    },
    notes: {
      t1Wave: 'Onda T1 do nSuns: 8/6/4/4/4/5/6/7/8+ repetições; a série-chave é AMRAP.',
      t1DeadliftWave: 'Onda T1 do nSuns: 5/3/1/3/3/3/5/7/4+ repetições; a série-chave é AMRAP.',
      t2UpperWave: 'Onda T2 do nSuns: 6/5/3/5/7/4/6/8 repetições.',
      t2LowerWave: 'Onda T2 do nSuns: 5/5/3/5/7/4/6/8 repetições.',
    },
  },
  startingStrength: {
    name: 'Starting Strength (3x5 A/B)',
    summary:
      'Progressão linear de Rippetoe para iniciantes: dois treinos de corpo inteiro, 3x5, mais carga a cada sessão.',
    attribution:
      'Starting Strength de Mark Rippetoe. Alterne os treinos A e B em 3 sessões por semana. Agachamento 3x5 em toda sessão; aumente 2,5-5 kg sempre que completar todas as repetições. O levantamento terra é 1x5. Reduza 10% ao estagnar.',
    programName: 'Starting Strength',
    description:
      'Progressão linear com barra para iniciantes, de Rippetoe. Dois treinos de corpo inteiro alternados, três sessões por semana. Agachamento 3x5 em toda sessão, com um pequeno aumento de carga sempre que completar todas as repetições prescritas.',
    phase: 'Força',
    workouts: {
      workoutA: 'Treino A - Agachamento / Supino / Terra',
      workoutB: 'Treino B - Agachamento / Desenvolvimento / Power clean',
    },
    notes: {
      squat: '3x5. Aumente 2,5-5 kg em toda sessão em que completar todas as repetições.',
      press: '3x5. Aumente a carga em toda sessão em que completar todas as repetições.',
      deadlift: '1 série de trabalho de 5. Aumente a carga a cada sessão.',
      powerClean: '5x3 puxadas explosivas. Iniciantes podem trocar por remada curvada.',
    },
  },
  stronglifts: {
    name: 'StrongLifts 5x5 (A/B)',
    summary:
      'Dois treinos de corpo inteiro alternados, 5x5 nos levantamentos principais, mais carga a cada sessão.',
    attribution:
      'StrongLifts 5x5, de Mehdi. Alterne os treinos A e B em 3 sessões por semana. 5x5 no agachamento, supino, desenvolvimento e remada; levantamento terra 1x5. Aumente 2,5 kg a cada sessão; reduza 10% depois de três tentativas sem sucesso.',
    programName: 'StrongLifts 5x5',
    description:
      'Dois treinos de corpo inteiro alternados, três vezes por semana. 5x5 nos levantamentos principais (terra 1x5). Aumente um pouco a carga a cada sessão e reduza 10% depois de estagnar três vezes.',
    phase: 'Força',
    workouts: {
      workoutA: 'Treino A - Agachamento / Supino / Remada',
      workoutB: 'Treino B - Agachamento / Desenvolvimento / Terra',
    },
    notes: {
      squat: '5x5. Aumente 2,5 kg em toda sessão em que completar todas as repetições.',
      mainLift: '5x5. Aumente a carga em toda sessão em que completar todas as repetições.',
      deadlift: '1 série de trabalho de 5. Aumente a carga a cada sessão.',
    },
  },
  madcow: {
    name: 'Madcow 5x5 (intermediário)',
    summary:
      '5x5 com progressão semanal: segunda pesada, quarta leve e sexta com uma série de 3 para recorde.',
    attribution:
      'Programa intermediário Madcow 5x5. Na segunda, a carga sobe em 5 séries até a mais pesada, de 5 repetições; a quarta é um volume mais leve de recuperação; na sexta, a carga sobe até uma série pesada, seguida de uma série mais leve (back-off). Progrida a carga de semana em semana, não de sessão em sessão.',
    programName: 'Madcow 5x5',
    description:
      '5x5 intermediário com progressão semanal. Na segunda, suba a carga série a série até uma série pesada; faça uma quarta mais leve; e bata uma nova série mais pesada na sexta. Aumente a carga de uma semana para a outra, não a cada sessão.',
    phase: 'Força',
    workouts: {
      monday: 'Segunda - Rampa pesada',
      wednesday: 'Quarta - Leve',
      friday: 'Sexta - Série pesada / Recorde',
    },
    notes: {
      squatRamp:
        'Suba a carga em 5 séries até a mais pesada, de 5 repetições. A última fica perto de 1-2 RIR.',
      ramp: 'Suba a carga em 5 séries até a mais pesada, de 5 repetições.',
      squatLight: 'Volume mais leve de recuperação; suba até a carga da 3ª série de segunda.',
      light: 'Volume mais leve de recuperação.',
      deadliftLight: 'Rampa mais leve; guarde o terra pesado para a progressão semanal.',
      squatTopSet:
        'Suba até uma série pesada de 3 (série de recorde) e depois faça uma série mais leve de 8.',
      benchTopSet:
        'Suba até uma série pesada de 3 (série de recorde) e depois faça uma série mais leve.',
      rowTopSet: 'Suba até uma série pesada e depois faça uma série mais leve.',
    },
  },
  phul: {
    name: 'PHUL (Power Hypertrophy Upper Lower)',
    summary:
      'Superiores/inferiores em 4 dias: dois dias pesados de força e dois dias de hipertrofia com mais repetições.',
    attribution:
      'PHUL (Power Hypertrophy Upper Lower). Dois dias de força (3-5 repetições nos levantamentos principais) e dois dias de hipertrofia (8-15 repetições). Progrida a carga nos dias de força; nos dias de hipertrofia, busque volume e a faixa de repetições.',
    programName: 'PHUL',
    description:
      'Power Hypertrophy Upper Lower. Dois dias de força, mais pesados, desenvolvem a força nos levantamentos principais (3-5 repetições) e dois dias de hipertrofia acumulam volume (8-15 repetições). Quatro sessões por semana.',
    phase: 'Hipertrofia',
    workouts: {
      upperPower: 'Superiores - Força',
      lowerPower: 'Inferiores - Força',
      upperHypertrophy: 'Superiores - Hipertrofia',
      lowerHypertrophy: 'Inferiores - Hipertrofia',
    },
  },
  phat: {
    name: 'PHAT (Power Hypertrophy Adaptive Training)',
    summary:
      'Divisão de 5 dias de Layne Norton: dois dias de força e três dias de hipertrofia com alto volume.',
    attribution:
      'PHAT, de Layne Norton. Dois dias de força treinam os levantamentos principais na faixa de 3-5 repetições; três dias de hipertrofia treinam os mesmos padrões com menos carga, por 8-20 repetições. Cinco sessões por semana, com alto volume total.',
    programName: 'PHAT',
    description:
      'Power Hypertrophy Adaptive Training (Layne Norton). Dois dias de força (3-5 repetições) desenvolvem a força e três dias de hipertrofia (8-20 repetições) geram volume para membros superiores e inferiores. Cinco sessões por semana.',
    phase: 'Hipertrofia',
    workouts: {
      upperPower: 'Superiores - Força',
      lowerPower: 'Inferiores - Força',
      backShouldersHypertrophy: 'Costas / Ombros - Hipertrofia',
      lowerHypertrophy: 'Inferiores - Hipertrofia',
      chestArmsHypertrophy: 'Peito / Braços - Hipertrofia',
    },
  },
  fullBody: {
    name: 'Corpo inteiro 3x/semana (iniciante)',
    summary: 'Programa de corpo inteiro para iniciantes, três sessões por semana, volume moderado.',
    attribution:
      'Corpo inteiro genérico para iniciantes, em três dias não consecutivos por semana. Cada sessão trabalha o corpo todo com um composto principal por padrão de movimento e um acessório. Aumente a carga quando chegar ao topo da faixa de repetições em todas as séries.',
    programName: 'Corpo inteiro 3x',
    description:
      'Programa de corpo inteiro para iniciantes, feito em três dias não consecutivos por semana. Cada dia tem um agachamento, uma dobradiça de quadril ou puxada, um empurrar e um acessório, na faixa de 6-15 repetições. Aumente a carga no topo de cada faixa.',
    phase: 'Geral',
    workouts: {
      fullBodyA: 'Corpo inteiro A',
      fullBodyB: 'Corpo inteiro B',
      fullBodyC: 'Corpo inteiro C',
    },
  },
} satisfies MessageShape<typeof english>;
