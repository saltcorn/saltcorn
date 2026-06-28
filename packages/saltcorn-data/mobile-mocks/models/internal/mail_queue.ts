// Mobile mock for the mail queue. Queuing/sending email is server-only; expose
// the class surface (webpack statically validates ESM named imports) with
// runtime-safe no-op statics that are never reached on mobile.

export class MailQueue {
  static async handleNotification(_o?: any, _user?: any): Promise<void> {}
  static async emptyQueue(_user?: any): Promise<void> {}
  static async loadNotifications(
    _userId?: number,
    _sendStatus?: string
  ): Promise<any[]> {
    return [];
  }
  static getPassedDelay(_notifications?: any): boolean {
    return false;
  }
}
