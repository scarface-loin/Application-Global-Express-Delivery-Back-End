// ==================== src/models/Notification.js ====================
class Notification {
  constructor({
    id,
    userId,
    title,
    body,
    type = 'info',
    data = {},
    isRead = false,
    createdAt = new Date()
  }) {
    this.id = id;
    this.userId = userId;
    this.title = title;
    this.body = body;
    this.type = type;
    this.data = data;
    this.isRead = isRead;
    this.createdAt = createdAt;
  }

  toFirestore() {
    return {
      userId: this.userId,
      title: this.title,
      body: this.body,
      type: this.type,
      data: this.data,
      isRead: this.isRead,
      createdAt: this.createdAt
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Notification({
      id: doc.id,
      ...data
    });
  }
}

module.exports = Notification;