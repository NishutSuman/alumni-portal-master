// src/services/email/providers/index.js
const GmailProvider = require('./GmailProvider');
const SendGridProvider = require('./SendGridProvider');
const ResendProvider = require('./ResendProvider');
const MailerSendProvider = require('./MailerSendProvider');

class EmailProviderFactory {
  static create(providerType, config) {
    switch (providerType.toLowerCase()) {
      case 'gmail':
        return new GmailProvider(config);

      case 'sendgrid':
        return new SendGridProvider(config);

      case 'resend':
        return new ResendProvider(config);

      case 'mailersend':
        return new MailerSendProvider(config);

      default:
        throw new Error(`Unsupported email provider: ${providerType}`);
    }
  }

  static getAvailableProviders() {
    return ['gmail', 'sendgrid', 'resend', 'mailersend'];
  }
}

module.exports = {
  EmailProviderFactory,
  GmailProvider,
  SendGridProvider,
  ResendProvider,
  MailerSendProvider
};