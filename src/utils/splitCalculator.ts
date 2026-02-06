export function splitEqual(
  totalAmount: number,
  numberOfPeople: number
): number[] {
  const base = Math.floor((totalAmount / numberOfPeople) * 100) / 100;
  const remainder =
    Math.round((totalAmount - base * numberOfPeople) * 100) / 100;

  const amounts = Array(numberOfPeople).fill(base);

  // Distribute remainder cents to the first few people
  if (remainder > 0) {
    const centsToDistribute = Math.round(remainder * 100);
    for (let i = 0; i < centsToDistribute; i++) {
      amounts[i] = Math.round((amounts[i] + 0.01) * 100) / 100;
    }
  }

  return amounts;
}

export function validateCustomSplit(
  amounts: number[],
  totalAmount: number
): boolean {
  const sum = amounts.reduce((acc, val) => acc + val, 0);
  return Math.abs(sum - totalAmount) < 0.01;
}
