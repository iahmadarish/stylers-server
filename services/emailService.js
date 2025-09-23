import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import User from "../models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Correct transporter function
const createTransporter = () => {
  try {
    if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
      throw new Error('Email credentials not found in environment variables');
    }
    
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  } catch (error) {
    console.error('❌ Transporter creation failed:', error.message);
    throw error;
  }
};

// Send order confirmation email (for both guest and logged-in users)
export const sendOrderConfirmationEmail = async (orderData) => {
  try {
    console.log('📧 Attempting to send email to:', orderData.email);

    // Validate email data
    if (!orderData.email) {
      console.error('❌ No email address provided');
      return { success: false, error: 'No email address provided' };
    }

    const transporter = createTransporter();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Order Confirmation</title>
        <style>
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://paarel.com/assets/01-B-KQiC7Y.png" alt="Mini Moonira Logo" />
          </div>
          <div class="content">
            <h2>Thank you, ${orderData.customerName}!</h2>
            <p>Your order <strong>${orderData.orderNumber}</strong> has been placed successfully.</p>
            <div class="order-details">
              <p><strong>Date:</strong> ${orderData.orderDate}</p>
              <p><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
              <p><strong>Payment Method:</strong> ${orderData.paymentMethod}</p>
            </div>
            <p>If you have any questions, feel free to contact us at <a href="mailto:support@paarel.com">support@paarel.com</a>.</p>
          </div>
          <div class="footer">
            <p>Follow us on:
              <a href="https://facebook.com/yourpage" target="_blank">Facebook</a> |
              <a href="https://instagram.com/yourpage" target="_blank">Instagram</a>
            </p>
            <p>&copy; ${new Date().getFullYear()} Mini Moonira. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `"Mini Moonira" <${process.env.EMAIL_USERNAME}>`,
      to: orderData.email,
      subject: `Order Confirmation - ${orderData.orderNumber}`,
      html: htmlContent,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', result.messageId);
    return { success: true };
  } catch (error) {
    console.error("❌ sendOrderConfirmationEmail error:", error);
    return { success: false, error: error.message };
  }
}

// Send admin notification (for both guest and logged-in orders)
export const sendAdminNotificationEmail = async (orderData) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'PAAREL',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME
      },
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USERNAME,
      subject: `🛒 New Order - ${orderData.orderNumber}`,
      html: `
        <h2>New Order Received</h2>
        <p><strong>Order Number:</strong> ${orderData.orderNumber}</p>
        <p><strong>Customer:</strong> ${orderData.customerName}</p>
        <p><strong>Email:</strong> ${orderData.email}</p>
        <p><strong>Total Amount:</strong> ${orderData.totalAmount}</p>
        <p><strong>Payment Method:</strong> ${orderData.paymentMethod}</p>
        <p><strong>Order Date:</strong> ${orderData.orderDate}</p>
        <p><strong>Order Type:</strong> ${orderData.isGuestOrder ? 'Guest Order' : 'Registered User Order'}</p>
      `,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Admin notification sent:', result.messageId);
    return { success: true };
  } catch (error) {
    console.error('❌ Admin notification failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Test email function
export const sendTestEmail = async (toEmail) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'PAAREL',
        address: process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USERNAME
      },
      to: toEmail,
      subject: 'Test Email - PAAREL System',
      html: `
        <h2>Test Email from PAAREL</h2>
        <p>This is a test email to verify your email configuration.</p>
        <p>If you received this email, your SMTP settings are working correctly!</p>
        <p><strong>Sent:</strong> ${new Date().toLocaleString()}</p>
      `,
      text: 'Test Email - If you received this email, your SMTP settings are working correctly!',
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ Test email failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Helper function to send email for both guest and logged-in orders
export const sendOrderEmails = async (order, toEmail, isGuest = false) => {
  const htmlContent = generateOrderConfirmationEmail(order, isGuest);
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: toEmail,
    subject: `Order Confirmation - ${order.orderNumber}`,
    html: htmlContent,
  };

  const result = await transporter.sendMail(mailOptions);
  console.log("✅ Mail sent successfully", result.messageId);
  return { success: true };
};

export const generateOrderConfirmationEmail = (order, isGuest = false) => {
  const customerName = isGuest
    ? order.guestCustomerInfo.name
    : order.user?.name || "Valued Customer";

  const customerEmail = isGuest
    ? order.guestCustomerInfo.email
    : order.user?.email || "";

  const shippingAddress = order.shippingAddress || {};
  const orderNumber = order.orderNumber;
  const orderAmount = order.totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'BDT' });
  const paymentMethod = order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "Paid Online";

  const trackLink = isGuest
    ? `https://paarel.com/track-order?orderNumber=${orderNumber}`
    : "https://paarel.com/profile";

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>Order Confirmation - Paarel</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #f7f9fc;
        margin: 0;
        padding: 20px 0;
        color: #333333;
      }
      .container {
        max-width: 650px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 5px 15px rgba(0,0,0,0.05);
      }
      .header {
        background: linear-gradient(135deg, #0073e6 0%, #005cbf 100%);
        padding: 25px 30px;
        text-align: center;
        color: white;
      }
      .header-content {
        max-width: 500px;
        margin: 0 auto;
      }
      .logo {
        max-width: 180px;
        margin-bottom: 15px;
      }
      .order-confirmed {
        font-size: 28px;
        font-weight: 600;
        margin: 10px 0;
      }
      .order-number {
        background: rgba(255,255,255,0.15);
        padding: 8px 15px;
        border-radius: 20px;
        display: inline-block;
        margin: 10px 0;
        font-weight: 500;
      }
      .content {
        padding: 30px;
      }
      .greeting {
        font-size: 20px;
        margin-bottom: 20px;
        color: #222;
      }
      .info-card {
        background: #fff9dfff;
        border-radius: 10px;
        padding: 20px;
        margin: 20px 0;
        border-left: 4px solid #0073e6;
      }
      .info-row {
        display: flex;
        margin-bottom: 12px;
      }
      .info-label {
        font-weight: 600;
        min-width: 140px;
        color: #555;
      }
      .info-value {
        flex: 1;
        color: #222;
      }
      .divider {
        height: 1px;
        background: #eaeaea;
        margin: 25px 0;
      }
      .cta-button {
        display: block;
        text-align: center;
        background: #2cffc7ff;
        color: #ffffffff;
        padding: 14px;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 600;
        margin: 25px 0;
        transition: background 0.2s;
     
      }
      .cta-button:hover {
        background: #69e3c2ff;
      }
      .support-section {
        background: #f0f7ff;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
        margin: 25px 0;
      }
      .support-title {
        font-weight: 600;
        margin-bottom: 10px;
        color: #0073e6;
      }
      .support-contact {
        color: #0073e6;
        text-decoration: none;
        font-weight: 500;
      }
      .footer {
        background: linear-gradient(135deg, #0073e6 0%, #005cbf 100%);
        padding: 25px;
        text-align: center;
        color: #666;
        font-size: 14px;
      }
      .social-links {
        margin: 15px 0;
      }
      .social-links a {
        display: inline-block;
        margin: 0 10px;
        color: #ffffffff;
        text-decoration: none;
      }
      .copyright {
        margin-top: 15px;
        color: #ffffffff;
        font-size: 13px;
      }
      @media (max-width: 650px) {
        .container {
          border-radius: 0;
        }
        .info-row {
          flex-direction: column;
          margin-bottom: 15px;
        }
        .info-label {
          margin-bottom: 5px;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="header-content">
          <img src="https://paarel.com/assets/01-B-KQiC7Y.png" alt="Paarel Logo" class="logo" />
          <h1 class="order-confirmed">PAAREL - Order Confirmation</h1>
          <div class="order-number">Order #${orderNumber}</div>
          <p>Thank you for shopping with us</p>
        </div>
      </div>

      <!-- Content -->
      <div class="content">
        <h2 class="greeting">Hello ${customerName},</h2>
        <p>Your order has been successfully placed and is being processed.</p>
        
        <!-- Order Details -->
        <div class="info-card">
          <h3 style="margin-bottom: 15px; color: #0073e6;">Order Information</h3>
          
          <div class="info-row">
            <div class="info-label">Customer Name:</div>
            <div class="info-value">${customerName}</div>
          </div>
          
          <div class="info-row">
            <div class="info-label">Email:</div>
            <div class="info-value">${customerEmail}</div>
          </div>
          
          <div class="info-row">
            <div class="info-label">Shipping Address:</div>
            <div class="info-value">
              ${shippingAddress.address}, ${shippingAddress.city}, 
              ${shippingAddress.state || ""}, ${shippingAddress.zipCode || ""}, 
              ${shippingAddress.country || "Bangladesh"}
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-label">Order Amount:</div>
            <div class="info-value" style="font-weight: 600; color: #0073e6;">${orderAmount}</div>
          </div>
          
          <div class="info-row">
            <div class="info-label">Payment Method:</div>
            <div class="info-value">${paymentMethod}</div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Track Order -->
        <h3 style="margin-bottom: 15px;">Track Your Order</h3>
        <p style="margin-bottom: 20px;">You can track your order status using the link below:</p>
        <a href="${trackLink}" class="cta-button">${isGuest ? "Track Your Order simplify" : "Check Order status & Details"}</a>

        <!-- Support Section -->
        <div class="support-section">
          <div class="support-title">Need Help?</div>
          <p>Contact our customer support team for assistance with your order</p>
          <p>
            <a href="mailto:support@paarel.com" class="support-contact">support@paarel.com</a> | 
            <a href="tel:01842942484" class="support-contact">01842942484</a>
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="social-links">
          <a href="https://facebook.com/paarelofficial" target="_blank">Facebook</a>
          <a href="https://instagram.com/parrel.official" target="_blank">Instagram</a>
          <a href="https://paarel.com" target="_blank">Website</a>
        </div>
        <div class="copyright">
          &copy; ${new Date().getFullYear()} Paarel. All rights reserved.
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
};