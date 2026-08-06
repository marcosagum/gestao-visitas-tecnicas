const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const defaultRooms = [
  'Palco Principal',
  'Camarins A/B',
  'Sala de Controle / FOH',
  'Área de Credenciamento',
  'Praça de Alimentação',
  'Acessos / Bilheteria',
  'Camarotes VIP',
  'Estacionamento / Carga',
];

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const mockVTs = [
  {
    event: 'Kid Abelha - Reunião de Alinhamento Arena',
    date: daysFromNow(2),
    responsible: 'Marcos Agum',
    companion: 'Roberto (Produtor Kid Abelha)',
    rooms: ['Palco Principal', 'Camarins A/B', 'Sala de Controle / FOH'],
    clientRequests: 'Necessidade de 12 canais de retorno sem fio IEM (In-Ear Monitor). O rider técnico exige camarim com ar condicionado forte.',
    specialNotes: 'Medir largura da rampa de acesso lateral ao palco para cases grandes de som.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Festival de Dança - Ensaio Geral',
    date: daysFromNow(0),
    responsible: 'Ana Carolina',
    companion: 'Clara Ramos (Diretora do Festival)',
    rooms: ['Palco Principal', 'Camarins A/B'],
    clientRequests: 'Necessidade de iluminação especial cênica de LED e piso de linóleo sobre o palco.',
    specialNotes: 'Verificar se a temperatura do ar condicionado da plateia pode ser mantida em 22°C.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Show Lançamento Sertanejo - Montagem',
    date: daysFromNow(1),
    responsible: 'Thiago Silva',
    companion: 'Gustavo Lima (Diretoria Artística)',
    rooms: ['Palco Principal', 'Estacionamento / Carga', 'Camarotes VIP'],
    clientRequests: 'Instalação de sonorização complementar nos camarotes VIP e rampa especial de acesso de cargas.',
    specialNotes: 'Exige gerador de energia trifásico de 250kVA reserva para painel de LED principal.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Convenção Inova 2026 - Alinhamento TI',
    date: daysFromNow(3),
    responsible: 'Felipe Castro',
    companion: 'Mariana Costa (Produtora Inova)',
    rooms: ['Área de Credenciamento', 'Praça de Alimentação', 'Acessos / Bilheteria'],
    clientRequests: 'Necessidade de link dedicado de internet de 500Mbps na área de credenciamento e totens de autoatendimento.',
    specialNotes: 'Check de roteadores Wi-Fi corporativos redundantes cobrindo a praça de alimentação inteira.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Congresso de Medicina - Expositores',
    date: daysFromNow(5),
    responsible: 'Dr. Leonardo',
    companion: 'Patricia Albuquerque (CRM Eventos)',
    rooms: ['Estacionamento / Carga', 'Praça de Alimentação', 'Acessos / Bilheteria'],
    clientRequests: 'Pontos de energia monofásicos em cada stand (total de 45 stands) na praça de alimentação.',
    specialNotes: 'Auditoria de segurança das instalações temporárias de gás na praça de alimentação.',
    status: 'pending',
    notified: false,
  },
  {
    event: 'Futebol Beneficente - Cobertura TI',
    date: daysFromNow(-1),
    responsible: 'Lucas Pereira',
    companion: 'Eduardo (Diretor de TI)',
    rooms: ['Camarotes VIP', 'Acessos / Bilheteria'],
    clientRequests: 'Configuração de rede interna para transmissão de streaming ao vivo de alta velocidade.',
    specialNotes: 'Cabeamento de fibra ótica temporário passando pelos camarotes VIP.',
    status: 'completed',
    notified: true,
  },
];

async function main() {
  await prisma.room.createMany({
    data: defaultRooms.map((name) => ({ name })),
    skipDuplicates: true,
  });

  for (const vt of mockVTs) {
    await prisma.visitaTecnica.create({ data: vt });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
