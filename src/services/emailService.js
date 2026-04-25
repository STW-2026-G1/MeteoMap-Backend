const nodemailer = require("nodemailer");
const logger = require("../config/logger");

/**
 * Servicio de Email
 * Maneja envío de emails usando Gmail SMTP con nodemailer
 */
class EmailService {
  constructor() {
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    
    if (!emailUser || !emailPassword) {
      logger.warn("EMAIL_USER o EMAIL_PASSWORD no están configurados");
    }

    // Configurar transporte de Gmail
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });
  }

  /**
   * Enviar email de recuperación de contraseña
   * @param {string} email - Email del usuario
   * @param {string} token - Token de recuperación
   * @returns {Promise<Object>} Información del email enviado
   */
  async sendPasswordResetEmail(email, token) {
    try {
      const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;

      // Enviar email usando nodemailer
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Recuperar contraseña - MeteoMap",
        html: this.generatePasswordResetEmailHTML(resetLink),
      });

      logger.info("Email de recuperación enviado", {
        email,
        messageId: info.messageId,
      });

      return info;
    } catch (err) {
      logger.error("Error enviando email de recuperación", {
        email,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Generar HTML para el email de recuperación
   * @param {string} resetLink - Enlace para resetear contraseña
   * @returns {string} HTML del email
   */
  generatePasswordResetEmailHTML(resetLink) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
              line-height: 1.6;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2c3e50;
              margin: 0;
              font-size: 24px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .button {
              display: inline-block;
              background-color: #3498db;
              color: white;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
            }
            .button:hover {
              background-color: #2980b9;
            }
            .footer {
              text-align: center;
              color: #7f8c8d;
              font-size: 12px;
              margin-top: 20px;
              border-top: 1px solid #ecf0f1;
              padding-top: 20px;
            }
            .warning {
              background-color: #fff3cd;
              border: 1px solid #ffc107;
              color: #856404;
              padding: 12px;
              border-radius: 4px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <div class="header">
                <h1>🌦️ MeteoMap</h1>
                <p>Recuperación de Contraseña</p>
              </div>

              <p>Hola,</p>
              <p>Recibimos una solicitud para recuperar tu contraseña. Haz clic en el botón de abajo para establecer una nueva contraseña:</p>

              <div class="button-container">
                <a href="${resetLink}" class="button">Recuperar Contraseña</a>
              </div>

              <p>O copia y pega este enlace en tu navegador:</p>
              <p style="word-break: break-all; background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                ${resetLink}
              </p>

              <div class="warning">
                <strong>⚠️ Seguridad:</strong> Este enlace no vence, pero úsalo lo antes posible. Si no solicitaste recuperar tu contraseña, ignora este email.
              </div>

              <p>¡Gracias por usar MeteoMap!</p>
              <p>El equipo de MeteoMap</p>

              <div class="footer">
                <p>Este es un email automático, no respondas a esta dirección.</p>
                <p>&copy; 2026 MeteoMap. Todos los derechos reservados.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
