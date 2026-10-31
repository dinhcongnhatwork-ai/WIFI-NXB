const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  let template = await prisma.template.findFirst();
  if (!template) {
    template = await prisma.template.create({
      data: {
        name: 'Mẫu Cổng Chào NXB Sự Thật',
        layoutJson: { theme: 'editorial', title: 'Nhà Xuất Bản Chính Trị Quốc Gia Sự Thật' },
      },
    });
    console.log('Created template:', template.id);
  }

  const campaignCount = await prisma.campaign.count();
  if (campaignCount === 0) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000);

    const c1 = await prisma.campaign.create({
      data: {
        name: 'Chiến dịch WiFi Marketing - Sảnh Chính & Hội Trường',
        ssid: 'WIFI MARKETING',
        templateId: template.id,
        startTime: thirtyDaysAgo,
        endTime: thirtyDaysLater,
        active: true,
        portalEnabled: true,
        redirectUrl: 'https://solutionai.com.vn',
        unifiSite: 'm5npy6bn',
      },
    });

    const c2 = await prisma.campaign.create({
      data: {
        name: 'Khách VIP & Đại Biểu Hội Nghị',
        ssid: 'WIFI MARKETING VIP',
        templateId: template.id,
        startTime: new Date(now.getTime() - 14 * 86400000),
        endTime: thirtyDaysLater,
        active: true,
        portalEnabled: true,
        redirectUrl: 'https://solutionai.com.vn/vip',
        unifiSite: 'm5npy6bn',
      },
    });

    const c3 = await prisma.campaign.create({
      data: {
        name: 'Điểm Danh Họp Ban Biên Tập & Cán Bộ',
        ssid: 'WIFI MARKETING',
        templateId: template.id,
        startTime: new Date(now.getTime() - 20 * 86400000),
        endTime: thirtyDaysLater,
        active: true,
        portalEnabled: true,
        unifiSite: 'm5npy6bn',
      },
    });

    console.log('Created campaigns:', [c1.name, c2.name, c3.name]);

    const meetings = await prisma.attendanceSession.findMany({ take: 20 });
    for (let i = 0; i < meetings.length; i++) {
      const assignedCampaign = i % 2 === 0 ? c3.id : c1.id;
      await prisma.attendanceSession.update({
        where: { id: meetings[i].id },
        data: { campaignId: assignedCampaign },
      });
    }
    console.log('Linked', meetings.length, 'meetings to campaigns');

    const sampleMacs = [
      'dc:41:a9:b3:41:f6', '5a:b3:ef:c3:96:4e', '4e:1f:e0:1e:d4:25',
      'a0:51:0b:0c:2f:06', '4a:9e:d8:b1:2f:37', '2c:54:91:a2:bb:12',
      '88:66:5a:11:cc:99', 'f0:18:98:e3:21:40', 'e4:5f:01:99:32:01',
      '34:2e:b7:81:49:10', '9c:fc:01:55:aa:bb', 'b8:27:eb:77:88:99',
    ];
    const phones = ['0903123456', '0912888999', '0987654321', '0934567890', '0978111222', null, null];

    const logsToCreate = [];
    for (let d = 30; d >= 0; d--) {
      const dayDate = new Date(now.getTime() - d * 86400000);
      const dayLogCount = 18 + Math.floor(Math.sin(d) * 6) + (d % 3 === 0 ? 8 : 0);
      for (let j = 0; j < dayLogCount; j++) {
        const hour = Math.random() < 0.75 
          ? (Math.random() < 0.5 ? 8 + Math.floor(Math.random() * 4) : 13 + Math.floor(Math.random() * 5))
          : 7 + Math.floor(Math.random() * 14);
        const minute = Math.floor(Math.random() * 60);
        const logTime = new Date(dayDate);
        logTime.setHours(hour, minute, Math.floor(Math.random() * 60));

        const mac = sampleMacs[Math.floor(Math.random() * sampleMacs.length)];
        const phone = phones[Math.floor(Math.random() * phones.length)];
        const campaignId = Math.random() < 0.55 ? c1.id : Math.random() < 0.85 ? c2.id : c3.id;

        logsToCreate.push({ mac, phone, campaignId, loginTime: logTime });
      }
    }
    await prisma.log.createMany({ data: logsToCreate });
    console.log('Created', logsToCreate.length, 'access logs across 30 days');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
