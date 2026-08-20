import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASSWORD;

    if (!user || !pass) {
      console.warn(
        'WARNING: Nodemailer email credentials (MAIL_USER or MAIL_PASSWORD) are not configured in .env. Email notifications will be skipped.',
      );
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  async sendMail({ to, subject, text = '', html = '' }) {
    if (!process.env.MAIL_USER || !process.env.MAIL_PASSWORD) {
      console.error('Nodemailer credentials missing. Skipping email send.');
      return null;
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.MAIL_USER,
        to,
        subject,
        text,
        html,
      });
      return info.messageId;
    } catch (error) {
      console.error('Email yuborishda xatolik yuz berdi:', error.message);
      return null; // Don't crash the application if email provider fails
    }
  }

  // Chiroyli ko'rinishdagi HTML zaxira ogohlantirish shabloni
  async sendLowStockAlert(
    productName: string,
    currentStock: number,
    minLevel: number,
  ) {
    const emailTo = process.env.MAIL_USER;
    if (!emailTo) return;

    const subject = `⚠️ Diqqat! "${productName}" zaxirasi kamayib ketdi`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #d9534f; margin-bottom: 20px; display: flex; align-items: center;">
          ⚠️ ZAXIRA OGOHLANTIRISHI (WMS)
        </h2>
        <p style="font-size: 16px; line-height: 1.5;">
          Tizimda <strong>"${productName}"</strong> mahsulotining joriy zaxira miqdori minimal chegaradan pastladi.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 15px;">
          <tr style="background-color: #f2f2f2;">
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Ko'rsatkich</th>
            <th style="text-align: left; padding: 10px; border: 1px solid #ddd;">Miqdor</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Joriy Qoldiq</td>
            <td style="padding: 10px; border: 1px solid #ddd; color: #d9534f; font-weight: bold;">${currentStock} ta</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Belgilangan Minimal Chegara</td>
            <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${minLevel} ta</td>
          </tr>
        </table>
        <p style="font-size: 14px; color: #777; margin-top: 30px;">
          Iltimos, omborni to'ldirish uchun ushbu mahsulotni kirim qilishni rejalashtiring.
        </p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          Ushbu xabar SkladControl (Ombor Boshqaruv Tizimi) tomonidan avtomatik ravishda yuborildi.
        </p>
      </div>
    `;

    return this.sendMail({ to: emailTo, subject, html });
  }
}
