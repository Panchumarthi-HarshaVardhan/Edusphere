import 'dotenv/config';
import app from './app.js';
import { NotificationService } from './services/notification.service.js';

const PORT = process.env.PORT || 5000;

// Validate provider configuration before accepting traffic or starting the worker.
NotificationService.initializeEmailDelivery();

// Background Email Queue Worker (Periodic Cron runner every 30s)
const emailWorker = setInterval(() => {
  NotificationService.processEmailQueue().catch(() => {
    console.error('[Email Queue Runner Error] Queue processing failed.');
  });
}, 30000);

const server = app.listen(PORT, () => {
  console.log(`EduSphere Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

export { server, emailWorker };
