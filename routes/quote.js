// routes/quote.js
import express from 'express';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Quote from '../models/Quote.js';

const router = express.Router();

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Quote form submission
router.post('/quote', async (req, res) => {
  try {
    const { fullName, phone, email, company, address, productType, deliveryDate, quantity, description } = req.body;

    // Validation
    if (!fullName || !phone || !email || !productType || !quantity || !description) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields'
      });
    }

    // Save to database
    const quote = new Quote({
      fullName,
      phone,
      email,
      company,
      address,
      productType,
      deliveryDate,
      quantity,
      description
    });

    await quote.save();

    // Email content for company
    const companyMailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'PAARÉL'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME}>`,
      to: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME,
      subject: `New Quote Request: ${productType}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">New Quote Request</h2>
          
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin-bottom: 15px;">Client Information</h3>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Company:</strong> ${company || 'Not provided'}</p>
            <p><strong>Address:</strong> ${address || 'Not provided'}</p>
          </div>

          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h3 style="color: #0369a1; margin-bottom: 15px;">Project Details</h3>
            <p><strong>Product Type:</strong> ${productType}</p>
            <p><strong>Quantity:</strong> ${quantity}</p>
            <p><strong>Delivery Date:</strong> ${deliveryDate || 'Not specified'}</p>
          </div>

          <div style="background: #f1f5f9; padding: 20px; border-radius: 5px; border-left: 4px solid #4F46E5;">
            <h4 style="color: #374151; margin-bottom: 10px;">Project Description:</h4>
            <p style="margin: 0;">${description.replace(/\n/g, '<br>')}</p>
          </div>

          <div style="margin-top: 20px; padding: 15px; background: #ecfdf5; border-radius: 5px;">
            <p style="margin: 0; color: #065f46;">
              <strong>Submitted:</strong> ${new Date().toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })}
            </p>
          </div>
        </div>
      `
    };

    // Send confirmation email to user
    const userMailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'PAARÉL'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME}>`,
      to: email,
      subject: 'Quote Request Received - PAARÉL',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
          <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; color: white; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">PAARÉL</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Custom Fashion Solutions</p>
          </div>
          
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #4F46E5; margin-top: 0;">Thank You for Your Quote Request!</h2>
            
            <p>Dear <strong>${fullName}</strong>,</p>
            
            <p>We have received your quote request for <strong>${productType}</strong> and our team is currently reviewing your requirements.</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4F46E5;">
              <h4 style="color: #374151; margin-bottom: 10px;">Request Summary:</h4>
              <p><strong>Product Type:</strong> ${productType}</p>
              <p><strong>Quantity:</strong> ${quantity}</p>
              <p><strong>Delivery Date:</strong> ${deliveryDate || 'To be discussed'}</p>
              <p><strong>Description:</strong> ${description.length > 100 ? description.substring(0, 100) + '...' : description}</p>
            </div>

            <p><strong>What happens next?</strong></p>
            <ul style="color: #4B5563;">
              <li>Our team will review your requirements within 24 hours</li>
              <li>We'll contact you to discuss details and provide a customized quote</li>
              <li>You'll receive competitive pricing and timeline estimates</li>
            </ul>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #0369a1; margin-bottom: 15px;">Need Immediate Assistance?</h4>
              <p><strong>📞 Hotline:</strong> +880 9613 002024</p>
              <p><strong>💬 WhatsApp:</strong> 01624-536363</p>
              <p><strong>📧 Email:</strong> support@paarel.com</p>
            </div>

            <p>We look forward to helping you with your project!</p>
            
            <p>Best regards,<br>
            <strong>The PAARÉL Team</strong></p>
          </div>
          
          <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">
              This is an automated response. For immediate assistance, please call our hotline.
            </p>
          </div>
        </div>
      `
    };

    try {
      // Send both emails
      await transporter.sendMail(companyMailOptions);
      await transporter.sendMail(userMailOptions);
      
      console.log('Quote request emails sent successfully');
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      message: 'Quote request submitted successfully! We will contact you within 24 hours.'
    });

  } catch (error) {
    console.error('Quote form error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again later.'
    });
  }
});

export default router;