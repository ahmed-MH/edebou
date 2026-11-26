/** WhatsApp chat link for a +216… number, with a ready-to-send message. */
export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${phone.replace(/^\+/u, "")}?text=${encodeURIComponent(message)}`;
}

/** Customer → shop, from a product page. */
export function productOrderMessage(productName: string): string {
  return `السلام عليكم 👋\nنحب نطلب: ${productName}\nتنجمو تعاونوني؟`;
}

/** Customer → shop, general question. */
export const generalQuestionMessage = "السلام عليكم 👋\nعندي سؤال على منتجات EDebou.";

/** Shop → customer, to confirm a cash-on-delivery order. */
export function orderConfirmationMessage(order: {
  readonly customerName: string;
  readonly orderNumber: string;
  readonly total: string;
}): string {
  return `السلام عليكم ${order.customerName} 👋\nمعاك EDebou بخصوص طلبك رقم ${order.orderNumber} (${order.total}).\nنحبو نأكدو معاك العنوان ووقت التوصيل. الدفع عند الاستلام. شكرا!`;
}

/** Shop → customer who started an order without finishing it. */
export function unfinishedOrderMessage(customerName: string | null): string {
  return `السلام عليكم${customerName ? ` ${customerName}` : ""} 👋\nمعاك EDebou. لاحظنا إنك بديت طلب وما كملتوش.\nتحب نعاونوك تكملو؟`;
}
