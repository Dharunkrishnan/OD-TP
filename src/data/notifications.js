// src/data/notifications.js
// Bell-icon notifications for the OD Claims Handler (mock).
// In production these come from the notification service (claim events, SLA engine, fraud rules).
// kind → icon/colour in NotificationsPopover. unread = not yet seen by the user.

export const NOTIFICATIONS = [
  { id: "n1", kind: "fraud", title: "Fraud red flag", text: "Theft within 30 days of policy inception", claimNo: "OD/CHN/26/004533", time: "09:12", group: "Today", unread: true },
  { id: "n2", kind: "survey", title: "Survey report received", text: "Final survey report uploaded by the surveyor", claimNo: "OD/CHN/26/004547", time: "08:40", group: "Today", unread: true },
  { id: "n3", kind: "sla", title: "SLA breached", text: "Documents pending 2 days beyond SLA", claimNo: "OD/CHN/26/004512", time: "08:00", group: "Today", unread: true },
  { id: "n4", kind: "docs", title: "Document uploaded", text: "Insured uploaded the RC copy", claimNo: "OD/CHN/26/004536", time: "07:55", group: "Today", unread: true },
  { id: "n5", kind: "major", title: "Major loss alert", text: "Estimate ₹1.42 L crossed the ₹1 L threshold", claimNo: "OD/CHN/26/004498", time: "Yesterday", group: "Earlier", unread: false },
  { id: "n6", kind: "delay", title: "Delay in intimation", text: "Intimated 9 days after the loss", claimNo: "NB/CHN/26/000191", time: "Yesterday", group: "Earlier", unread: false },
  { id: "n7", kind: "payment", title: "Payment released", text: "NEFT of ₹23,600 sent to the network garage", claimNo: "OD/CHN/26/004402", time: "27 Oct", group: "Earlier", unread: false },
];