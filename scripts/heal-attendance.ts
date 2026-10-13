import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function heal() {
  const now = new Date();
  const regs = await prisma.attendanceRegistration.findMany({
    include: {
      intervals: { orderBy: { joinedAt: 'asc' } },
      session: true,
    },
  });

  console.log(`Found ${regs.length} registrations to recalculate.`);

  for (const reg of regs) {
    let exactPresentSeconds = 0;
    for (const intv of reg.intervals) {
      if (intv.leftAt) {
        exactPresentSeconds +=
          intv.durationSeconds ??
          Math.max(0, Math.floor((new Date(intv.leftAt).getTime() - new Date(intv.joinedAt).getTime()) / 1000));
      } else if (reg.status === 'PRESENT') {
        exactPresentSeconds += Math.max(0, Math.floor((now.getTime() - new Date(intv.joinedAt).getTime()) / 1000));
      }
    }

    const effectiveFirstSeen = reg.firstSeenAt || (reg.status === 'PRESENT' ? now : null);
    let exactAbsentSeconds = 0;
    if (effectiveFirstSeen) {
      const totalElapsed = Math.max(0, Math.floor((now.getTime() - new Date(effectiveFirstSeen).getTime()) / 1000));
      exactAbsentSeconds = Math.max(0, totalElapsed - exactPresentSeconds);
    }

    await prisma.attendanceRegistration.update({
      where: { id: reg.id },
      data: {
        totalPresentSeconds: exactPresentSeconds,
        totalAbsentSeconds: exactAbsentSeconds,
        totalUnknownSeconds: 0,
      },
    });

    console.log(`Updated ${reg.displayName} (${reg.status}): Present=${exactPresentSeconds}s (${Math.floor(exactPresentSeconds / 60)}m), Absent=${exactAbsentSeconds}s (${Math.floor(exactAbsentSeconds / 60)}m)`);
  }
}

heal()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
