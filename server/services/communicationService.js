const nodemailer = require('nodemailer');
const twilio = require('twilio');
const logger = require('../utils/logger');

// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    service: 'SendGrid',
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY
    }
  });
};

// Generate phone verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send email verification
const sendEmailVerification = async (email, token) => {
  try {
    const transporter = createEmailTransporter();

    const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@kspa.com',
      to: email,
      subject: 'Verify Your Email - Kspa Car Broker',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Kspa</h1>
            <p style="color: white; margin: 5px 0 0 0;">Car Sales Broker Platform</p>
          </div>

          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Verify Your Email Address</h2>

            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Thank you for registering with Kspa! To complete your registration and start using our platform,
              please verify your email address by clicking the button below.
            </p>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${verificationUrl}"
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; padding: 15px 30px; text-decoration: none;
                        border-radius: 5px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>

            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              This link will expire in 24 hours.<br>
              If you didn't create this account, you can safely ignore this email.
            </p>
          </div>

          <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 Kspa Car Broker. All rights reserved.</p>
            <p>Connecting local showrooms with customers nationwide</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Email verification sent to ${email}`, { messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Failed to send email verification', error);
    throw new Error('Failed to send verification email');
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, token) => {
  try {
    const transporter = createEmailTransporter();

    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@kspa.com',
      to: email,
      subject: 'Reset Your Password - Kspa Car Broker',
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Kspa</h1>
            <p style="color: white; margin: 5px 0 0 0;">Car Sales Broker Platform</p>
          </div>

          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Reset Your Password</h2>

            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              We received a request to reset your password for your Kspa account.
              Click the button below to set a new password.
            </p>

            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetUrl}"
                 style="background: #ff6b6b; color: white; padding: 15px 30px;
                        text-decoration: none; border-radius: 5px; font-weight: bold;
                        display: inline-block;">
                Reset Password
              </a>
            </div>

            <p style="color: #999; font-size: 14px; text-align: center; margin-top: 30px;">
              This link will expire in 1 hour for security reasons.<br>
              If you didn't request this password reset, you can safely ignore this email.
            </p>
          </div>

          <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 Kspa Car Broker. All rights reserved.</p>
            <p>Connecting local showrooms with customers nationwide</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Password reset email sent to ${email}`, { messageId: result.messageId });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Failed to send password reset email', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send phone verification code
const sendPhoneVerification = async (phone, userId) => {
  try {
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const verificationCode = generateVerificationCode();

    // In development, just log the code
    if (process.env.NODE_ENV === 'development') {
      logger.info(`Phone verification code for ${phone}: ${verificationCode}`);
      return { success: true, code: verificationCode };
    }

    const message = await client.messages.create({
      body: `Your Kspa verification code is: ${verificationCode}. This code will expire in 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone
    });

    // Store verification code in user document
    const User = require('../models/User');
    await User.findByIdAndUpdate(userId, {
      'security.phoneVerificationCode': verificationCode,
      'security.phoneVerificationExpires': Date.now() + 10 * 60 * 1000 // 10 minutes
    });

    logger.info(`Phone verification code sent to ${phone}`, { sid: message.sid });
    return { success: true, sid: message.sid };
  } catch (error) {
    logger.error('Failed to send phone verification', error);
    throw new Error('Failed to send verification code');
  }
};

// Verify phone number
const verifyPhoneNumber = async (phone, code) => {
  try {
    const User = require('../models/User');

    const user = await User.findOne({
      phone: phone,
      'security.phoneVerificationCode': code,
      'security.phoneVerificationExpires': { $gt: Date.now() }
    });

    if (!user) {
      return {
        success: false,
        error: 'Invalid or expired verification code'
      };
    }

    return {
      success: true,
      userId: user._id
    };
  } catch (error) {
    logger.error('Phone verification error', error);
    return {
      success: false,
      error: 'Failed to verify phone number'
    };
  }
};

// Send appointment confirmation
const sendAppointmentConfirmation = async (appointment, customer, showroom, vehicle) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@kspa.com',
      to: customer.profile.email || customer.email,
      subject: `Appointment Confirmation - ${vehicle.title}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Kspa</h1>
            <p style="color: white; margin: 5px 0 0 0;">Car Sales Broker Platform</p>
          </div>

          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">Appointment Confirmed!</h2>

            <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Appointment Details</h3>
              <p><strong>Type:</strong> ${appointment.type.replace('_', ' ').toUpperCase()}</p>
              <p><strong>Date & Time:</strong> ${new Date(appointment.scheduledTime).toLocaleString()}</p>
              <p><strong>Duration:</strong> ${appointment.duration} minutes</p>
              <p><strong>Location:</strong> ${appointment.location.address}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Vehicle Information</h3>
              <p><strong>Vehicle:</strong> ${vehicle.title}</p>
              <p><strong>Price:</strong> ₹${vehicle.pricing.listedPrice.toLocaleString()}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Showroom Information</h3>
              <p><strong>Name:</strong> ${showroom.showroomInfo.businessName}</p>
              <p><strong>Address:</strong> ${showroom.profile.location.address}</p>
              <p><strong>Phone:</strong> ${showroom.phone}</p>
            </div>

            <p style="color: #666; line-height: 1.6;">
              Please arrive 10 minutes before your scheduled appointment. If you need to reschedule or cancel,
              please contact us at least 2 hours in advance.
            </p>
          </div>

          <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 Kspa Car Broker. All rights reserved.</p>
            <p>Connecting local showrooms with customers nationwide</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Appointment confirmation sent to ${customer.email}`, {
      appointmentId: appointment._id,
      messageId: result.messageId
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Failed to send appointment confirmation', error);
    throw new Error('Failed to send appointment confirmation');
  }
};

// Send inquiry notification to showroom
const sendInquiryNotification = async (showroom, customer, vehicle, message) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.FROM_EMAIL || 'noreply@kspa.com',
      to: showroom.email,
      subject: `New Vehicle Inquiry - ${vehicle.title}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">Kspa</h1>
            <p style="color: white; margin: 5px 0 0 0;">Car Sales Broker Platform</p>
          </div>

          <div style="padding: 30px; background: #f9f9f9;">
            <h2 style="color: #333; margin-bottom: 20px;">New Vehicle Inquiry!</h2>

            <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Customer Information</h3>
              <p><strong>Name:</strong> ${customer.profile.name}</p>
              <p><strong>Email:</strong> ${customer.email}</p>
              <p><strong>Phone:</strong> ${customer.phone || 'Not provided'}</p>
              <p><strong>Location:</strong> ${customer.profile.city || 'Not provided'}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Vehicle Information</h3>
              <p><strong>Vehicle:</strong> ${vehicle.title}</p>
              <p><strong>Price:</strong> ₹${vehicle.pricing.listedPrice.toLocaleString()}</p>
            </div>

            <div style="background: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
              <h3 style="color: #667eea; margin-top: 0;">Customer Message</h3>
              <p style="color: #666; line-height: 1.6;">${message}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL}/dashboard/messages"
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white; padding: 15px 30px; text-decoration: none;
                        border-radius: 5px; font-weight: bold; display: inline-block;">
                View Message
              </a>
            </div>

            <p style="color: #666; font-size: 14px;">
              Please respond to this inquiry within 24 hours for the best customer experience.
            </p>
          </div>

          <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p>&copy; 2024 Kspa Car Broker. All rights reserved.</p>
            <p>Connecting local showrooms with customers nationwide</p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info(`Inquiry notification sent to showroom ${showroom.email}`, {
      vehicleId: vehicle._id,
      customerId: customer._id,
      messageId: result.messageId
    });
    return { success: true, messageId: result.messageId };
  } catch (error) {
    logger.error('Failed to send inquiry notification', error);
    throw new Error('Failed to send inquiry notification');
  }
};

module.exports = {
  sendEmailVerification,
  sendPasswordResetEmail,
  sendPhoneVerification,
  verifyPhoneNumber,
  sendAppointmentConfirmation,
  sendInquiryNotification
};