// testEmail.js
import dotenv from 'dotenv';
import { sendTestEmail } from './services/emailService.js';

// Load environment variables
dotenv.config();

// আপনার ইমেইল এড্রেস দিয়ে replace করুন
const testEmail = 'im.ishaq.bd@gmail.com';

console.log('🚀 Sending test email to:', testEmail);
console.log('📧 Using email:', process.env.EMAIL_USERNAME);

sendTestEmail(testEmail)
  .then(result => {
    console.log('Test result:', result);
    if (result.success) {
      console.log('✅ Test email sent successfully!');
    } else {
      console.log('❌ Test email failed:', result.error);
    }
  })
  .catch(error => {
    console.error('Test error:', error);
  });