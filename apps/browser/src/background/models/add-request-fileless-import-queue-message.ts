import NotificationQueueMessage from "./notificationQueueMessage";
import { NotificationQueueMessageType } from "./notificationQueueMessageType";

export default class AddRequestFilelessImportQueueMessage extends NotificationQueueMessage {
  type: NotificationQueueMessageType.RequestFilelessImport;
  importType?: string;
}
