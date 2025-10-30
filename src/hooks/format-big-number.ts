export const format = (number: number) => {
  if (number < 1_000) return number;
  if (number < 1_000_000) return `${round(number / 1_000)} thousand`;
  if (number < 1_000_000_000) return `${round(number / 1_000_000)} million`;
  if (number < 1_000_000_000_000)
    return `${round(number / 1_000_000_000)} billion`;
  if (number < 1_000_000_000_000_000)
    return `${round(number / 1_000_000_000_000)} trillion`;
  return `${round(number / 1_000_000_000_000_000)} quadrillion`;
};

const round = (number: number) => Math.round(number * 100) / 100;
