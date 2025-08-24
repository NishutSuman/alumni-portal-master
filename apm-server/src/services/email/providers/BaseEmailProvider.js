class BaseEmailProvider {
  constructor(config) {
    this.config = config;
  }

  async sendEmail(to, subject, htmlContent, data) {
    throw new Error('sendEmail method must be implemented by provider');
  }

  async testConnection() {
    throw new Error('testConnection method must be implemented by provider');
  }
}

module.exports = BaseEmailProvider;