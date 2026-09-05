export const giftSellContent = {
  sourceLabel: "Gifts",
  settlement: {
    title: "Gift settlement period",
    paragraphs: [
      "Orders involving Stars received through gifts are reviewed before they become eligible for payout.",
      "The expected settlement period begins when the order is accepted.",
    ],
    acknowledgement:
      "I understand that this gift order will not be immediately eligible for payout.",
  },
  evidence: {
    title: "Verify your gifted Stars",
    description:
      "Upload evidence showing how the gifts were received and converted into Stars. Include enough context for the order to be reviewed.",
    items: [
      {
        type: "gift_history",
        title: "Gift history",
        instructions:
          "Screenshots of your Telegram gift history showing the relevant gifts and dates.",
        multiple: true,
      },
      {
        type: "gift_details",
        title: "Gift details",
        instructions:
          "Open each relevant gift and upload screenshots showing its sender, date, and details.",
        multiple: true,
      },
      {
        type: "telegram_confirmation",
        title: "Telegram confirmation",
        instructions:
          "Upload Telegram messages or confirmations showing that the gifts or Stars were received.",
        multiple: true,
      },
      {
        type: "other",
        title: "Other supporting evidence",
        instructions:
          "Optional screenshots that provide useful context for the review.",
        multiple: true,
        optional: true,
      },
    ],
  },
} as const;
