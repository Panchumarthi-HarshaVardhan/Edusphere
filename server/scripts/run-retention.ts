import 'dotenv/config';
import { PrivacyService } from '../src/services/privacy.service.js';
import { prisma } from '../src/utils/prisma.js';

try {
  const result = await PrivacyService.runRetentionSweep();
  console.info('[Privacy retention sweep complete]', result);
} catch (error) {
  console.error('[Privacy retention sweep failed]', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
