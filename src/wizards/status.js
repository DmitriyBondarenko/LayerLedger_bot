import { sendMessage, editMessageText } from "../lib/telegram.js";
import { optionsKeyboard, actionsKeyboard, mergeKeyboards } from "../lib/keyboard.js";
import { setDraft, clearDraft } from "../lib/kv.js";
import { escapeHtml } from "../lib/format.js";
import { formatShortDate } from "../lib/date.js";
import { STATUSES, STATUS_LABELS, PAYMENT_STATUSES, PAYMENT_STATUS_LABELS } from "../constants.js";
import { queryStatusChangeableOrders } from "../commands/orders.js";
import { applyStatusUpdate, applyPaymentUpdate } from "../commands/status.js";

// Order names often repeat (same client, several orders), so the button label
// adds the deadline as a disambiguator — same idea as toOrderButtons's hint
// elsewhere, just inlined since this keyboard indexes by position, not page id.
// Здано orders get the ✅ prefix instead of a status suffix — the checkmark
// already says "done", no need to also spell out "Здано" next to it.
function orderStepKeyboard(orders) {
  const names = orders.map((o) => o.name);
  const labels = orders.map((o) => {
    const suffix = o.deadline ? ` — ${formatShortDate(o.deadline)}` : "";
    if (o.status === "Здано") return `✅ ${o.name}${suffix}`;
    const index = STATUSES.indexOf(o.status);
    const statusText = index === -1 ? "" : ` · ${STATUS_LABELS[index]}`;
    return `${o.name}${suffix}${statusText}`;
  });
  return mergeKeyboards(optionsKeyboard(names, "st:o", 1, labels), actionsKeyboard([{ label: "Скасувати", data: "st:cancel" }]));
}

function statusStepKeyboard() {
  return mergeKeyboards(optionsKeyboard(STATUSES, "st:s", 1, STATUS_LABELS), actionsKeyboard([{ label: "Скасувати", data: "st:cancel" }]));
}

function paymentStepKeyboard() {
  return mergeKeyboards(optionsKeyboard(PAYMENT_STATUSES, "st:p", 1, PAYMENT_STATUS_LABELS), actionsKeyboard([{ label: "Пропустити", data: "st:pskip" }]));
}

export async function start(env, chatId) {
  await clearDraft(env, chatId);

  const results = await queryStatusChangeableOrders(env);
  if (!results.length) {
    return sendMessage(env, chatId, "Немає замовлень для зміни статусу чи оплати 😿");
  }

  const orders = results.map((page) => ({
    id: page.id,
    name: page.properties["Назва"]?.title?.[0]?.plain_text || "(без назви)",
    status: page.properties["Статус"]?.select?.name,
    deadline: page.properties["Дедлайн"]?.date?.start,
  }));

  const draft = { type: "status", step: 0, orders };
  const res = await sendMessage(env, chatId, "🗂 Оберіть замовлення:", orderStepKeyboard(orders));
  const body = await res.json();
  draft.messageId = body?.result?.message_id;
  return setDraft(env, chatId, draft);
}

export async function handleCallback(env, chatId, messageId, data, draft) {
  const [, action, arg] = data.split(":");

  if (action === "cancel") {
    await clearDraft(env, chatId);
    let text = "❌ Скасовано.";
    if (draft.step === 2) {
      text = draft.statusJustChanged
        ? `Статус «${escapeHtml(draft.selectedOrderName)}» вже змінено на Здано ✅. Оплату не оновлено.`
        : `Оплату для «${escapeHtml(draft.selectedOrderName)}» не оновлено.`;
    }
    return editMessageText(env, chatId, messageId, text, { inline_keyboard: [] });
  }

  if (draft.step === 0 && action === "o") {
    const order = draft.orders[parseInt(arg, 10)];
    if (!order) return;
    draft.selectedOrderId = order.id;
    draft.selectedOrderName = order.name;
    draft.messageId = messageId;

    if (order.status === "Здано") {
      draft.step = 2;
      draft.statusJustChanged = false;
      await setDraft(env, chatId, draft);
      return editMessageText(
        env,
        chatId,
        messageId,
        `Замовлення: <b>${escapeHtml(order.name)}</b>\n\nСтатус вже <b>Здано</b> ✅\n\n💰 Оплату отримано повністю?`,
        paymentStepKeyboard()
      );
    }

    draft.step = 1;
    await setDraft(env, chatId, draft);
    return editMessageText(
      env,
      chatId,
      messageId,
      `Замовлення: <b>${escapeHtml(order.name)}</b>\n\n🔄 Оберіть новий статус:`,
      statusStepKeyboard()
    );
  }

  if (draft.step === 1 && action === "s") {
    const newStatus = STATUSES[parseInt(arg, 10)];
    if (!newStatus) return;
    await applyStatusUpdate(env, draft.selectedOrderId, newStatus);

    if (newStatus === "Здано") {
      draft.step = 2;
      draft.statusJustChanged = true;
      draft.messageId = messageId;
      await setDraft(env, chatId, draft);
      return editMessageText(
        env,
        chatId,
        messageId,
        `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на Здано ✅\n\n💰 Оплату отримано повністю?`,
        paymentStepKeyboard()
      );
    }

    await clearDraft(env, chatId);
    return editMessageText(
      env,
      chatId,
      messageId,
      `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на ${newStatus} ✅`,
      { inline_keyboard: [] }
    );
  }

  if (draft.step === 2 && action === "pskip") {
    await clearDraft(env, chatId);
    const text = draft.statusJustChanged
      ? `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на Здано ✅\nОплату не оновлено.`
      : `Оплату для «${escapeHtml(draft.selectedOrderName)}» не оновлено.`;
    return editMessageText(env, chatId, messageId, text, { inline_keyboard: [] });
  }

  if (draft.step === 2 && action === "p") {
    const paymentStatus = PAYMENT_STATUSES[parseInt(arg, 10)];
    if (!paymentStatus) return;
    await applyPaymentUpdate(env, draft.selectedOrderId, paymentStatus);

    // Здано + fully paid = nothing left to do on this order, so archive it.
    const archived = paymentStatus === "Оплачено повністю";
    if (archived) await applyStatusUpdate(env, draft.selectedOrderId, "Архів");

    await clearDraft(env, chatId);
    const archiveNote = archived ? "\n🗄 Замовлення заархівовано." : "";
    const text = draft.statusJustChanged
      ? `Статус «${escapeHtml(draft.selectedOrderName)}» змінено на Здано ✅\nОплата: ${paymentStatus} ✅${archiveNote}`
      : `Оплата для «${escapeHtml(draft.selectedOrderName)}» оновлена: ${paymentStatus} ✅${archiveNote}`;
    return editMessageText(env, chatId, messageId, text, { inline_keyboard: [] });
  }
}
