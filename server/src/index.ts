import 'dotenv/config';
import app from './app.js';
import { NotificationService } from './services/notification.service.js';

const PORT = process.env.PORT || 5000;

// Validate provider configuration before accepting traffic or starting the worker.
NotificationService.initializeEmailDelivery();

// Background Email Queue Worker (only in non-serverless environments)
let emailWorker: NodeJS.Timeout | undefined;
if (!process.env.VERCEL) {
  emailWorker = setInterval(() => {
    NotificationService.processEmailQueue().catch(() => {
      console.error('[Email Queue Runner Error] Queue processing failed.');
    });
  }, 30000);

  app.listen(PORT, () => {
    console.log(`EduSphere Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

export default app;
export { emailWorker };
