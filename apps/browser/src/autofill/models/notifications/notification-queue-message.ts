import { NotificationQueueMessageType } from "./notification-queue-message-type";

export default class NotificationQueueMessage {
  type: NotificationQueueMessageType;
  domain: string;
  tabId: number;
  expires: Date;
  wasVaultLocked: boolean;
}
