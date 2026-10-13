import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);

  await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
    },
  });

  const sampleLayout = {
    type: 'page',
    children: [
      {
        type: 'logo',
        props: {
          src: 'https://placehold.co/200x60/3b82f6/ffffff?text=WiFi+Logo',
          alt: 'WiFi Logo',
          width: '160px',
          position: 'center',
          padding: '24px 16px 8px',
        },
      },
      {
        type: 'banner',
        props: {
          src: 'https://placehold.co/800x300/1e293b/94a3b8?text=Welcome+Banner',
          height: '200px',
          objectFit: 'cover',
          overlay: true,
          overlayColor: 'rgba(0,0,0,0.35)',
          title: 'Free High-Speed WiFi',
          subtitle: 'Connect and enjoy seamless internet access',
          textColor: '#ffffff',
        },
      },
      {
        type: 'spacer',
        props: { height: '16px' },
      },
      {
        type: 'text',
        props: {
          content: '<h2 style="margin:0">Welcome!</h2><p style="color:#64748b;margin:4px 0 0">Enter your phone number to connect</p>',
          align: 'center',
          fontSize: '16px',
        },
      },
      {
        type: 'spacer',
        props: { height: '8px' },
      },
      {
        type: 'image',
        props: {
          src: 'https://placehold.co/600x200/f1f5f9/64748b?text=Promotion+Image',
          alt: 'Promotion',
          width: '100%',
          height: '160px',
          objectFit: 'cover',
          borderRadius: '12px',
        },
      },
      {
        type: 'spacer',
        props: { height: '80px' },
      },
      {
        type: 'bottom_connect',
        props: {
          showPhone: true,
          phonePlaceholder: 'Enter phone number',
          buttonText: 'Connect WiFi',
          buttonBgColor: '#3b82f6',
          buttonColor: '#ffffff',
          buttonRadius: '50px',
          bgColor: '#ffffff',
          termsText: 'By connecting, you agree to our Terms of Service',
          padding: '16px 20px',
        },
      },
    ],
  };

  await prisma.template.upsert({
    where: { id: 'sample-template-1' },
    update: {},
    create: {
      id: 'sample-template-1',
      name: 'Default WiFi Portal',
      layoutJson: sampleLayout,
      status: 'published',
    },
  });

  console.log('Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
