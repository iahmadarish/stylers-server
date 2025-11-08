// routes/contact.js
import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Contact from '../models/Contact.js';

const router = express.Router();

// Email transporter setup - tomrar .env onujayi
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, subject, message } = req.body;

    // Validation
    if (!firstName || !lastName || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    // Save to database
    const contact = new Contact({
      firstName,
      lastName,
      email,
      phone,
      subject,
      message
    });

    await contact.save();

    // Email content for company
    const companyMailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'PAARÉL'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME}>`,
      to: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME, // Company email
      subject: `New Contact Form: ${subject || 'No Subject'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">New Contact Form Submission</h2>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px;">
            <h3 style="color: #374151;">Contact Details:</h3>
            <p><strong>Name:</strong> ${firstName} ${lastName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
            <p><strong>Subject:</strong> ${subject || 'No Subject'}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}</p>
          </div>
          <div style="margin-top: 20px;">
            <h3 style="color: #374151;">Message:</h3>
            <p style="background: #f1f5f9; padding: 15px; border-radius: 5px; border-left: 4px solid #4F46E5;">
              ${message.replace(/\n/g, '<br>')}
            </p>
          </div>
        </div>
      `
    };

    // Send confirmation email to user
    const userMailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'PAARÉL'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: 'Thank you for contacting PAARÉL',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
          <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">PAARÉL</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Fashion Destination</p>
          </div>
          
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #4F46E5; margin-top: 0;">Thank You for Contacting Us!</h2>
            
            <p>Dear <strong>${firstName}</strong>,</p>
            
            <p>We have successfully received your message and our team will get back to you within 24 hours.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
              <h4 style="color: #374151; margin-bottom: 10px;">Your Message Summary:</h4>
              <p><strong>Subject:</strong> ${subject || 'General Inquiry'}</p>
              <p><strong>Message:</strong> ${message.length > 150 ? message.substring(0, 150) + '...' : message}</p>
            </div>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #0369a1; margin-bottom: 15px;">Our Contact Information</h4>
              <p><strong>📍 Address:</strong><br>
              Rowshan Complex, 1st floor<br>
              Plot-M26, Senpara, Section-14<br>
              Mirpur, Dhaka-1206</p>
              
              <p><strong>📞 Phone:</strong><br>
              09613002024 | 01624-536363</p>
              
              <p><strong>🕒 Business Hours:</strong><br>
              9:00 AM - 5:00 PM</p>
            </div>

            <p>We appreciate your interest in PAARÉL and look forward to assisting you!</p>
            
            <p>Best regards,<br>
            <strong>The PAARÉL Team</strong></p>
          </div>
          
          <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              This is an automated response. Please do not reply to this email.
            </p>
          </div>
        </div>
      `
    };

    try {
      // Send both emails
      await transporter.sendMail(companyMailOptions);
      await transporter.sendMail(userMailOptions);
      
      console.log('Emails sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails, just log it
    }

    res.status(200).json({
      success: true,
      message: 'Message sent successfully! We will contact you soon.'
    });

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

// Get all contacts (for admin)
router.get('/contacts', async (req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: contacts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching contacts'
    });
  }
});

export default router;